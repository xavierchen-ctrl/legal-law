import { sendNotificationEmail } from '@/lib/email';
import { differenceInCalendarDays, addBusinessDays, isValid } from 'date-fns';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { logSystemEvent } from './logger';
import { parseSheetDate } from '@/lib/date-utils';

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

            /* DISABLED
            const isDev = process.env.NODE_ENV === 'development';
            const envTag = isDev ? '【測試站】' : '【正式站】';
            // ... (HTML construction) ...
            await sendNotificationEmail(adminRecipients.join(','), subject, html);
            */
        }

        // 2. Circuit Breaker for Requesters
        /* DISABLED individual notifications as per user request
        const SAFETY_LIMIT = 20;

        if (requesterNotifications.size > SAFETY_LIMIT) {
             // ...
        } else {
            // ...
        }
        */

        const summaryMsg = `Processed ${contracts.length} contracts. Found ${results.length} issues. Digest Sent. Requester Notifications: ${requesterNotifications.size > SAFETY_LIMIT ? 'Suppressed' : 'Sent'};`;
        await logSystemEvent('Daily_Check', 'SUCCESS', summaryMsg);
        return { success: true, processed: results.length, details: results };
    } catch (error) {
        console.error('Check failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('Daily_Check', 'ERROR', errMsg);
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
