import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { findUserByEmail } from '@/lib/user-directory';
import { parseSheetDate } from '@/lib/date-utils';
import { differenceInCalendarDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
    const contracts = await fetchContractsFromSheet();
    const today = new Date();
    const pending = [];

    for (const contract of contracts) {
        if (['CLOSED', 'PAUSED'].includes(contract.status)) continue;
        if (contract.isArchived) continue;
        if (!contract.requestDate || contract.requestDate.trim() === '') continue;

        const contractNumVal = parseInt(contract.contractNumber.replace(/\D/g, ''), 10);
        if (isNaN(contractNumVal) || contractNumVal < 250056) continue;

        const requesterName = contract.requester?.trim() || '';
        if (!requesterName) continue;

        const derivedEmail = `${requesterName.toLowerCase().replace(/\s+/g, '.')}@wavenet.com.tw`;
        const inDirectory = !!findUserByEmail(derivedEmail);
        if (inDirectory) continue; // 在目錄裡的自動發送，不需人工

        // 判斷是否需要催辦
        let needsFollowUp = false;
        let reason = '';

        if (contract.lastReplyDate) {
            const replyDate = parseSheetDate(contract.lastReplyDate);
            if (replyDate) {
                const days = differenceInCalendarDays(today, replyDate);
                if (days >= 7) { needsFollowUp = true; reason = `法務回覆後已 ${days} 天未進入待用印`; }
            }
        } else {
            const reqDate = parseSheetDate(contract.requestDate);
            if (reqDate) {
                const days = differenceInCalendarDays(today, reqDate);
                if (days >= 7) { needsFollowUp = true; reason = `申請後已 ${days} 天仍無法務回覆`; }
            }
        }

        if (contract.stampCompleted && !contract.isArchived) {
            needsFollowUp = true;
            reason = '用印完成但尚未歸檔';
        }

        if (!needsFollowUp) continue;

        pending.push({
            contractNumber: contract.contractNumber,
            documentName: contract.documentName,
            requester: requesterName,
            derivedEmail,
            reason,
            lastReplyDate: contract.lastReplyDate,
            stampCompleted: contract.stampCompleted,
        });
    }

    return NextResponse.json({ pending });
}
