import { sendNotificationEmail } from '@/lib/email';
import { differenceInCalendarDays, addBusinessDays, isValid } from 'date-fns';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { logSystemEvent } from './logger';

export async function checkAndSendOverdueNotifications() {
    const results = [];
    console.log('[NotificationService] Starting Overdue Check...');
    try {
        await logSystemEvent('Daily_Check', 'INFO', 'Starting daily overdue check...');
        const contracts = await fetchContractsFromSheet();
        const ceoEmail = process.env.CEO_EMAIL || 'ceo@example.com';
        // Allow multiple additional recipients via ENV (comma separated)
        const envRecipients = process.env.NOTIFICATION_RECIPIENTS
            ? process.env.NOTIFICATION_RECIPIENTS.split(',').map(e => e.trim())
            : [];

        // Base Recipients for every email (CEO + Configured List)
        const baseRecipients = Array.from(new Set([ceoEmail, ...envRecipients]));

        for (const contract of contracts) {
            if (contract.status === 'CLOSED') continue;
            // Only check overdue if it's pending Legal action
            if (contract.status === 'AWAITING_FEEDBACK' || contract.status === 'PAUSED') continue;

            // Placeholder Check: Skip if no requestDate (Empty slot)
            if (!contract.requestDate || contract.requestDate.trim() === '') continue;

            // Legacy Filter: Skip logic for old contracts (Before W250056)
            const contractNumStr = contract.contractNumber.replace(/\D/g, '');
            const contractNumVal = parseInt(contractNumStr, 10);
            if (!isNaN(contractNumVal) && contractNumVal < 250056) continue;

            const today = new Date();

            // --- 1. Legal Review Overdue Check ---
            // Logic: Deadline = RequestDate + (URGENT? 3 : 5) business days
            let deadline = null;
            const reqDate = new Date(contract.requestDate);

            if (isValid(reqDate)) {
                const daysToAdd = contract.priority === 'URGENT' ? 3 : 5;
                deadline = addBusinessDays(reqDate, daysToAdd);
            } else if (contract.estimatedReplyDate) {
                const est = new Date(contract.estimatedReplyDate);
                if (isValid(est)) deadline = est;
            }

            if (deadline) {
                const overdueDays = differenceInCalendarDays(today, deadline);
                let shouldNotify = false;

                // Rules: Urgent > 1 day buffer, Normal > 3 days buffer
                if (contract.priority === 'URGENT' && overdueDays > 1) shouldNotify = true;
                else if (contract.priority === 'NORMAL' && overdueDays > 3) shouldNotify = true;

                if (shouldNotify) {
                    const recipients = [...baseRecipients];
                    if (contract.requesterEmail) recipients.push(contract.requesterEmail);
                    // Remove duplicates
                    const uniqueRecipients = Array.from(new Set(recipients));

                    const subject = `[逾期通知] 合約 ${contract.contractNumber} (${contract.priority === 'URGENT' ? '急件' : '普通'}) 已超過審閱期限`;
                    const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #d32f2f;">合約審閱逾期通知</h2>
                <p>以下合約已超過系統計算之預定回覆日期 (申請日 + 工期)，請儘速處理。</p>
                <hr />
                <ul>
                <li><strong>合約編號:</strong> ${contract.contractNumber}</li>
                <li><strong>文件名稱:</strong> ${contract.documentName}</li>
                <li><strong>申請人:</strong> ${contract.requester}</li>
                <li><strong>申請日期:</strong> ${contract.requestDate}</li>
                <li><strong>預定回覆日:</strong> ${deadline.toLocaleDateString()}</li>
                <li><strong>逾期天數:</strong> ${overdueDays} 天</li>
                </ul>
                <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
            </div>
            `;

                    await sendNotificationEmail(uniqueRecipients.join(','), subject, html);
                    results.push({ id: contract.id, type: 'Review_Overdue' });
                }
            }

            // --- 2. Post-Review Overdue Check ---
            // Logic: Reviewed (lastReplyDate exists) but NOT Closed for > 14 days
            if (contract.lastReplyDate && contract.status !== 'CLOSED') {
                const replyDate = new Date(contract.lastReplyDate);
                if (isValid(replyDate)) {
                    const postReviewDays = differenceInCalendarDays(today, replyDate);
                    if (postReviewDays > 14) {
                        const recipients = [...baseRecipients];
                        if (contract.requesterEmail) recipients.push(contract.requesterEmail);
                        const uniqueRecipients = Array.from(new Set(recipients));

                        const subject = `[未結案警示] 合約 ${contract.contractNumber} 已回覆超過 14 天尚未結案`;
                        const html = `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #ed6c02;">合約未結案警示</h2>
                <p>以下合約法務已於 <strong>${contract.lastReplyDate}</strong> 回覆，但迄今已超過 14 天仍未結案。</p>
                <p>請確認是否已簽約完成，並更新試算表狀態。</p>
                <hr />
                <ul>
                  <li><strong>合約編號:</strong> ${contract.contractNumber}</li>
                  <li><strong>文件名稱:</strong> ${contract.documentName}</li>
                  <li><strong>申請人:</strong> ${contract.requester}</li>
                  <li><strong>最後回覆日:</strong> ${contract.lastReplyDate}</li>
                  <li><strong>滯留天數:</strong> ${postReviewDays} 天</li>
                </ul>
                <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
              </div>
            `;
                        await sendNotificationEmail(uniqueRecipients.join(','), subject, html);
                        results.push({ id: contract.id, type: 'PostReview_Overdue' });
                    }
                }
            }
        }
        const summaryMsg = `Processed ${contracts.length} contracts. Overdue: ${results.length}.`;
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

        // Filter: Department contains "執行長" AND Status is not CLOSED
        const ceoContracts = contracts.filter(c => {
            if (c.status === 'CLOSED') return false;
            if (!c.requestDate || c.requestDate.trim() === '') return false; // Ignore placeholders
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

        await sendNotificationEmail(ceoEmail, subject, html);
        await logSystemEvent('Weekly_Report', 'SUCCESS', `Sent summary for ${ceoContracts.length} items to ${ceoEmail}`);
        return { success: true, count: ceoContracts.length };

    } catch (error) {
        console.error('CEO Summary failed:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent('Weekly_Report', 'ERROR', errMsg);
        return { success: false, error };
    }
}
