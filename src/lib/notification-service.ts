import { sendNotificationEmail } from '@/lib/email';
import { differenceInCalendarDays, addBusinessDays, isValid } from 'date-fns';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { logSystemEvent } from './logger';
import { parseSheetDate } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import { findUserByEmail, findSupervisorEmail } from '@/lib/user-directory';

export async function checkAndSendOverdueNotifications() {
    const results = [];
    console.log('[NotificationService] Starting Overdue Check...');
    try {
        await logSystemEvent('Daily_Check', 'INFO', 'Starting daily overdue check...');
        const contracts = await fetchContractsFromSheet();
        const ceoEmail = process.env.CEO_EMAIL || 'ceo@example.com';

        // Admin Recipients (for Digest)
        const envRecipients = process.env.NOTIFICATION_RECIPIENTS
            ? process.env.NOTIFICATION_RECIPIENTS.split(',').map(e => e.trim())
            : [];
        const adminRecipients = Array.from(new Set([ceoEmail, ...envRecipients]));

        // Collection for Digest
        interface OverdueItem { contract: any; days: number; type: string; recipient?: string; }
        const pendingDigestItems: OverdueItem[] = [];

        // Collection for Individual Requester Notifications
        // Map<Email, List<Items>>
        const requesterNotifications = new Map<string, OverdueItem[]>();

        for (const contract of contracts) {
            if (contract.status === 'CLOSED') continue;
            // Only check overdue if it's pending Legal action
            if (contract.status === 'AWAITING_FEEDBACK' || contract.status === 'PAUSED') continue;

            // Placeholder Check: Skip if no requestDate (Empty slot)
            if (!contract.requestDate || contract.requestDate.trim() === '') continue;

            // Legacy Filter: Skip logic for old contracts (Before W250056)
            const contractNumStr = contract.contractNumber.replace(/\D/g, '');
            const contractNumVal = parseInt(contractNumStr, 10);

            // Fix: If NaN (no numbers in ID), assuming it's an old/malformed entry and SKIP it to be safe.
            // Or if < 250056 (Year 25 #56).
            if (isNaN(contractNumVal) || contractNumVal < 250056) continue;

            const today = new Date();

            // --- 1. Legal Review Overdue Check ---
            // Logic: Deadline = RequestDate + (URGENT? 3 : 5) business days
            let deadline = null;
            const reqDate = parseSheetDate(contract.requestDate);

            if (reqDate) {
                const daysToAdd = contract.priority === 'URGENT' ? 3 : 5;
                deadline = addBusinessDays(reqDate, daysToAdd);
            } else if (contract.estimatedReplyDate) {
                const est = parseSheetDate(contract.estimatedReplyDate);
                if (est) deadline = est;
            }

            if (deadline) {
                const overdueDays = differenceInCalendarDays(today, deadline);
                let shouldNotify = false;

                // Rules: Urgent > 1 day buffer, Normal > 3 days buffer
                if (contract.priority === 'URGENT' && overdueDays > 1) shouldNotify = true;
                else if (contract.priority === 'NORMAL' && overdueDays > 3) shouldNotify = true;

                // FIX: If Legal has already replied, it is NOT 'Review Overdue' anymore.
                // It moves to 'Post-Review' tracking (Check 2).
                if (contract.lastReplyDate) shouldNotify = false;

                if (shouldNotify) {
                    const item = { contract, days: overdueDays, type: '審閱逾期', recipient: contract.requesterEmail };
                    pendingDigestItems.push(item);

                    if (contract.requesterEmail) {
                        if (!requesterNotifications.has(contract.requesterEmail)) {
                            requesterNotifications.set(contract.requesterEmail, []);
                        }
                        requesterNotifications.get(contract.requesterEmail)!.push(item);
                    }
                    results.push({ id: contract.id, type: 'Review_Overdue' });
                }
            }

            // --- 2. Post-Review Overdue Check ---
            // Logic: Reviewed (lastReplyDate exists) but NOT Closed for > 14 days
            if (contract.lastReplyDate && contract.status !== 'CLOSED') {
                const replyDate = parseSheetDate(contract.lastReplyDate);
                if (replyDate) {
                    const postReviewDays = differenceInCalendarDays(today, replyDate);
                    if (postReviewDays > 14) {
                        const item = { contract, days: postReviewDays, type: '未結案逾期', recipient: contract.requesterEmail };
                        pendingDigestItems.push(item);

                        if (contract.requesterEmail) {
                            if (!requesterNotifications.has(contract.requesterEmail)) {
                                requesterNotifications.set(contract.requesterEmail, []);
                            }
                            requesterNotifications.get(contract.requesterEmail)!.push(item);
                        }
                        results.push({ id: contract.id, type: 'PostReview_Overdue' });
                    }
                }
            }
        }

        // --- SAFETY MECHANISM ---

        // --- SAFETY MECHANISM ---

        // 1. Send Daily Digest to Admin (Always send if items exist)
        if (pendingDigestItems.length > 0) {
            // [MODIFIED] User requested to STOP daily emails. Only keeping Weekly Report.
            // We just log the findings for system monitoring.
            console.log(`[Daily Check] Found ${pendingDigestItems.length} overdue items. Email notification is DISABLED.`);
        }

        const summaryMsg = `Processed ${contracts.length} contracts. Found ${results.length} issues. Daily Emails DISABLED.`;
        await logSystemEvent('Daily_Check', 'SUCCESS', summaryMsg);
        return { success: true, processed: results.length, details: results };
    } catch (error) {
        console.error('Check failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('Daily_Check', 'ERROR', errMsg);
        return { success: false, error };
    }
}

// ─── 歸檔提醒：每日掃描「待用印」超過 7 / 14 天未歸檔的合約 ───────────────
export async function checkAndSendArchiveReminders() {
    const results: { contractNumber: string; days: number; recipients: string[] }[] = [];
    try {
        await logSystemEvent('Archive_Reminder', 'INFO', 'Starting archive reminder check...');

        // 取得所有「待用印」且未歸檔的追蹤紀錄
        const pendingRecords = await prisma.contractTracking.findMany({
            where: {
                trackingStatus: 'PENDING_STAMP',
                archivedAt: null,
                stampRequestedAt: { not: null },
                archiveNotifyEmails: { not: null },
            },
        });

        if (pendingRecords.length === 0) {
            await logSystemEvent('Archive_Reminder', 'SUCCESS', 'No pending stamp contracts to remind.');
            return { success: true, reminded: 0 };
        }

        // 從 Google Sheets 取得合約名稱（用於信件內文）
        const sheetContracts = await fetchContractsFromSheet();
        const sheetMap = new Map(sheetContracts.map(c => [c.contractNumber, c]));

        const today = new Date();

        for (const record of pendingRecords) {
            const daysPending = differenceInCalendarDays(today, record.stampRequestedAt!);

            // 7 天發第一次、14 天發第二次（每 7 天提醒一次）
            const shouldRemind = daysPending >= 7 && daysPending % 7 === 0;
            if (!shouldRemind) continue;

            let emails: { name: string; email: string }[] = [];
            try { emails = JSON.parse(record.archiveNotifyEmails!); } catch { continue; }
            if (emails.length === 0) continue;

            const isUrgent = daysPending >= 14;
            const sheetContract = sheetMap.get(record.contractNumber);
            const docName = sheetContract?.documentName ?? '（未知文件）';
            const department = sheetContract?.department ?? '（未知部門）';

            const subject = isUrgent
                ? `【緊急提醒】合約 ${record.contractNumber} 待歸檔已逾 ${daysPending} 天`
                : `【提醒】合約 ${record.contractNumber} 待歸檔通知（已等待 ${daysPending} 天）`;

            const urgentBanner = isUrgent
                ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin-bottom:16px;border-radius:4px;">
                     <strong style="color:#dc2626;">⚠ 此為第二次提醒：</strong>
                     <span style="color:#b91c1c;">距離待用印狀態已超過 ${daysPending} 天，請盡快完成歸檔。</span>
                   </div>`
                : '';

            const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1d4ed8;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約歸檔提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    ${urgentBanner}
    <p>您好，以下合約已完成用印作業，請確認是否已完成歸檔（電子檔及紙本）：</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f3f4f6;">
        <td style="padding:10px 12px;font-weight:600;width:40%;">合約編號</td>
        <td style="padding:10px 12px;">${record.contractNumber}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border-top:1px solid #e5e7eb;">文件名稱</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">${docName}</td>
      </tr>
      <tr style="background:#f3f4f6;">
        <td style="padding:10px 12px;font-weight:600;">需求部門</td>
        <td style="padding:10px 12px;">${department}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border-top:1px solid #e5e7eb;">進入待用印日期</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">${record.stampRequestedAt!.toLocaleDateString('zh-TW')}</td>
      </tr>
      <tr style="background:#fef9c3;">
        <td style="padding:10px 12px;font-weight:600;color:#92400e;">待歸檔天數</td>
        <td style="padding:10px 12px;font-weight:700;color:#b45309;">已等待 ${daysPending} 天</td>
      </tr>
    </table>
    <p>請確認用印作業是否完成，並更新系統狀態為「已歸檔」，或聯繫法務人員協助。</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
      此為系統自動通知，請勿直接回覆本信件。
    </p>
  </div>
</div>`;

            const recipientEmails = emails.map(e => e.email);
            for (const toEmail of recipientEmails) {
                await sendNotificationEmail(toEmail, subject, html);
            }

            // 更新最後提醒時間
            await prisma.contractTracking.update({
                where: { contractNumber: record.contractNumber },
                data: { lastArchiveReminderAt: today },
            });

            results.push({ contractNumber: record.contractNumber, days: daysPending, recipients: recipientEmails });
        }

        const msg = `Archive reminder: checked ${pendingRecords.length} records, sent reminders for ${results.length} contracts.`;
        await logSystemEvent('Archive_Reminder', 'SUCCESS', msg);
        return { success: true, reminded: results.length, details: results };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('Archive_Reminder', 'ERROR', errMsg);
        return { success: false, error };
    }
}

// ─── 催辦提醒：法務已回覆 7 天後仍未進入「待用印」，發信給申請人及直屬主管 ──
export async function checkAndSendFollowUpReminders() {
    const results: { contractNumber: string; trigger: string; recipients: string[] }[] = [];
    try {
        await logSystemEvent('FollowUp_Reminder', 'INFO', 'Starting follow-up reminder check...');
        const contracts = await fetchContractsFromSheet();
        const today = new Date();

        for (const contract of contracts) {
            // 跳過已結案、已暫停、已待用印（目標狀態）
            if (['CLOSED', 'PAUSED', 'PENDING_STAMP'].includes(contract.status)) continue;

            // 跳過無申請日期的空白列
            if (!contract.requestDate || contract.requestDate.trim() === '') continue;

            // 跳過舊合約（W250056 以前）
            const contractNumVal = parseInt(contract.contractNumber.replace(/\D/g, ''), 10);
            if (isNaN(contractNumVal) || contractNumVal < 250056) continue;

            let shouldRemind = false;
            let triggerReason = '';

            if (contract.lastReplyDate) {
                // 條件 A：法務已有最新回覆日，滿 7 天後（每 7 天一次）仍未進入待用印
                const replyDate = parseSheetDate(contract.lastReplyDate);
                if (replyDate) {
                    const daysSinceReply = differenceInCalendarDays(today, replyDate);
                    if (daysSinceReply >= 7 && daysSinceReply % 7 === 0) {
                        shouldRemind = true;
                        triggerReason = `法務回覆後 ${daysSinceReply} 天未進入待用印`;
                    }
                }
            } else {
                // 條件 B：無任何回覆日，申請已超過 7 天（每 7 天一次）
                const reqDate = parseSheetDate(contract.requestDate);
                if (reqDate) {
                    const daysSinceReq = differenceInCalendarDays(today, reqDate);
                    if (daysSinceReq >= 7 && daysSinceReq % 7 === 0) {
                        shouldRemind = true;
                        triggerReason = `申請後 ${daysSinceReq} 天仍無法務回覆日`;
                    }
                }
            }

            if (!shouldRemind) continue;

            const requesterName = contract.requester?.trim() || '';
            const caseRef = `【用印申請】${contract.contractNumber} : ${contract.documentName || contract.counterparty || '合約申請案'}`;

            let recipients: string[] = [];
            let subject = '';
            let html = '';

            if (!contract.lastReplyDate) {
                // ── 條件 B：仍在審閱中，通知法務承辦人 ──
                const LEGAL_EMAIL = 'thea.chen@wavenet.com.tw';
                const reqDate = parseSheetDate(contract.requestDate);
                const daysSinceReq = reqDate ? differenceInCalendarDays(today, reqDate) : 0;

                recipients = [LEGAL_EMAIL];
                subject = `【審閱逾期提醒】${contract.contractNumber} 已逾 ${daysSinceReq} 天尚未回覆`;
                html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#7c3aed;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約審閱逾期提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.8;">
    <p>法務承辦人 您好，</p>
    <p>以下合約申請案自送件起已逾 <strong>${daysSinceReq} 天</strong>，系統尚未偵測到法務回覆紀錄，請確認審閱進度：</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px;font-weight:600;width:35%;">合約編號</td>
        <td style="padding:8px 12px;">${contract.contractNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;border-top:1px solid #e5e7eb;">文件名稱</td>
        <td style="padding:8px 12px;border-top:1px solid #e5e7eb;">${contract.documentName || '（未填）'}</td>
      </tr>
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px;font-weight:600;">申請人</td>
        <td style="padding:8px 12px;">${requesterName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:600;border-top:1px solid #e5e7eb;">申請日期</td>
        <td style="padding:8px 12px;border-top:1px solid #e5e7eb;">${contract.requestDate}</td>
      </tr>
      <tr style="background:#fef9c3;">
        <td style="padding:8px 12px;font-weight:600;color:#92400e;">已逾天數</td>
        <td style="padding:8px 12px;font-weight:700;color:#b45309;">${daysSinceReq} 天</td>
      </tr>
    </table>
    <p>請儘速完成審閱並更新回覆日期，謝謝。</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#6b7280;font-size:12px;">此為系統自動通知，請勿直接回覆本信件。</p>
  </div>
</div>`;
            } else {
                // ── 條件 A：已回覆，催辦申請人 ──
                if (!requesterName) {
                    console.log(`[FollowUp] ${contract.contractNumber}: 申請人欄位空白，略過`);
                    continue;
                }
                const requesterEmail = `${requesterName.toLowerCase().replace(/\s+/g, '.')}@wavenet.com.tw`;
                const userRecord = findUserByEmail(requesterEmail);
                const supervisorEmail = userRecord?.supervisorName
                    ? findSupervisorEmail(userRecord.supervisorName)
                    : null;

                recipients = [requesterEmail];
                if (supervisorEmail) recipients.push(supervisorEmail);

                subject = caseRef;
                html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1d4ed8;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約進度催辦提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.8;">
    <p>${requesterName} 您好，</p>
    <p>這是一封自動提醒郵件。</p>
    <p>關於您先前提交的合約申請案（${caseRef}），法務單位已完成初步審閱並提供相關修改建議。</p>
    <p>為了確保後續用印及簽署流程能順利進行，請您儘速跟進此申請案的進度（包括但不限於與契約相對人確認合約審閱意見、確認用印申請進度以及於合約線上表單更新合約紙本與電子檔歸檔進度等），並針對本案為後續相關作業。</p>
    <p>若您對審閱建議有任何疑問，建議可先與法務承辦人溝通確認。</p>
    <p>謝謝您的配合。</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#6b7280;font-size:12px;">此為系統自動通知，請勿直接回覆本信件。</p>
  </div>
</div>`;
            }

            for (const toEmail of recipients) {
                await sendNotificationEmail(toEmail, subject, html);
            }

            await logSystemEvent('FollowUp_Reminder', 'INFO',
                `Sent follow-up for ${contract.contractNumber} (${triggerReason}) → ${recipients.join(', ')}`);
            results.push({ contractNumber: contract.contractNumber, trigger: triggerReason, recipients });
        }

        const msg = `Follow-up reminder: checked ${contracts.length} contracts, sent ${results.length} reminders.`;
        await logSystemEvent('FollowUp_Reminder', 'SUCCESS', msg);
        return { success: true, reminded: results.length, details: results };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('FollowUp_Reminder', 'ERROR', errMsg);
        return { success: false, error };
    }
}

// ─── 用印完成但未歸檔提醒 ──────────────────────────────────────────────────────
export async function checkAndSendStampDoneReminders() {
    const results: { contractNumber: string; days: number; recipients: string[] }[] = [];
    try {
        await logSystemEvent('StampDone_Reminder', 'INFO', 'Starting stamp-done reminder check...');
        const contracts = await fetchContractsFromSheet();
        const today = new Date();

        for (const contract of contracts) {
            // 只處理：用印完成 && 尚未歸檔
            if (!contract.stampCompleted || contract.isArchived) continue;
            if (!contract.requestDate || contract.requestDate.trim() === '') continue;

            // 跳過舊合約
            const contractNumVal = parseInt(contract.contractNumber.replace(/\D/g, ''), 10);
            if (isNaN(contractNumVal) || contractNumVal < 250056) continue;

            // 以 X 欄完成用印日期為基準；若無則以申請日期代替
            const baseDateStr = contract.stampCompletedDate || contract.requestDate;
            const baseDate = parseSheetDate(baseDateStr);
            if (!baseDate) continue;

            const daysSince = differenceInCalendarDays(today, baseDate);
            // 滿 7 天後每 7 天提醒一次
            if (daysSince < 7 || daysSince % 7 !== 0) continue;

            // 申請人 email
            const requesterName = contract.requester?.trim() || '';
            if (!requesterName) continue;
            const requesterEmail = `${requesterName.trim().toLowerCase().replace(/\s+/g, '.')}@wavenet.com.tw`;

            // 主管 email
            const userRecord = findUserByEmail(requesterEmail);
            const supervisorEmail = userRecord?.supervisorName
                ? findSupervisorEmail(userRecord.supervisorName)
                : null;

            const recipients: string[] = [requesterEmail];
            if (supervisorEmail) recipients.push(supervisorEmail);

            const caseRef = `【用印申請】${contract.contractNumber} : ${contract.documentName || contract.counterparty || '合約申請案'}`;
            const subject = `【歸檔提醒】${contract.contractNumber} 用印已完成，請更新歸檔狀態`;

            const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#059669;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約歸檔作業提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.8;">
    <p>${requesterName} 您好，</p>
    <p>這是一封自動提醒郵件。</p>
    <p>
      關於合約申請案（${caseRef}），系統偵測到雙方用印作業已完成，
      但合約線上表單尚未更新歸檔狀態（已逾 <strong>${daysSince} 天</strong>）。
    </p>
    <p>
      請您儘速於合約線上表單更新合約紙本與電子檔歸檔進度，以完成本案結案作業。
    </p>
    <p>若您對歸檔流程有任何疑問，請與法務承辦人確認。</p>
    <p>謝謝您的配合。</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#6b7280;font-size:12px;">此為系統自動通知，請勿直接回覆本信件。</p>
  </div>
</div>`;

            for (const toEmail of recipients) {
                await sendNotificationEmail(toEmail, subject, html);
            }

            await logSystemEvent('StampDone_Reminder', 'INFO',
                `Sent stamp-done reminder for ${contract.contractNumber} (${daysSince}d) → ${recipients.join(', ')}`);
            results.push({ contractNumber: contract.contractNumber, days: daysSince, recipients });
        }

        const msg = `Stamp-done reminder: checked ${contracts.length} contracts, sent ${results.length} reminders.`;
        await logSystemEvent('StampDone_Reminder', 'SUCCESS', msg);
        return { success: true, reminded: results.length, details: results };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('StampDone_Reminder', 'ERROR', errMsg);
        return { success: false, error };
    }
}

export async function sendCeoUnclosedSummary(targetEmail?: string) {
    try {
        await logSystemEvent('Weekly_Report', 'INFO', 'Preparing weekly CEO summary...');
        const contracts = await fetchContractsFromSheet();
        const ceoEmail = targetEmail || process.env.CEO_EMAIL || 'ceo@example.com';

        // Include additional recipients from ENV
        const envRecipients = process.env.NOTIFICATION_RECIPIENTS
            ? process.env.NOTIFICATION_RECIPIENTS.split(',').map(e => e.trim())
            : [];

        // Combine CEO + Additional Recipients (Unique)
        const allRecipients = Array.from(new Set([ceoEmail, ...envRecipients]));

        // Filter: Department contains "執行長" AND Status is not CLOSED
        const ceoContracts = contracts.filter(c => {
            if (c.status === 'CLOSED') return false;
            if (!c.requestDate || c.requestDate.trim() === '') return false; // Ignore placeholders

            // Legacy Filter: Skip logic for old contracts (Before W250056)
            const contractNumStr = c.contractNumber.replace(/\D/g, '');
            const contractNumVal = parseInt(contractNumStr, 10);
            if (!isNaN(contractNumVal) && contractNumVal < 250056) return false;
            // Check department (fuzzy match)
            if (c.department && c.department.includes('執行長')) return true;
            return false;
        });

        if (ceoContracts.length === 0) {
            return { success: true, message: 'No unclosed contracts for CEO office.' };
        }

        const subject = `[每日彙整] 執行長室未結案法務文件報告 (${ceoContracts.length}件)`;

        const rows = ceoContracts.map(c => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${c.contractNumber}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${c.documentName}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${c.requester}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${c.status === 'IN_REVIEW' ? '審閱中' : c.status === 'AWAITING_FEEDBACK' ? '待回覆' : c.status}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${c.lastReplyDate ? `已回覆 (${c.lastReplyDate})` : '尚未回覆'}</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #2e7d32;">執行長室法務案件進度匯報</h2>
                <p>以下為截至目前為止，歸屬於「執行長室」且尚未結案之文件清單：</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">合約編號</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">文件名稱</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">申請人</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">狀態</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">進度備註</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動排程發送。</p>
            </div>
        `;

        await sendNotificationEmail(allRecipients.join(','), subject, html);
        await logSystemEvent('Weekly_Report', 'SUCCESS', `Sent summary for ${ceoContracts.length} items to ${allRecipients.join(', ')}`);
        return { success: true, count: ceoContracts.length };

    } catch (error) {
        console.error('CEO Summary failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('Weekly_Report', 'ERROR', errMsg);
        return { success: false, error };
    }
}
