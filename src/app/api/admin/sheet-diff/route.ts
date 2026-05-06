import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    const all = await fetchContractsFromSheet();

    // 全部筆數（含空白列已被 filter 掉）
    const totalSheet = all.length;

    // Dashboard 預設隱藏的歷史案件（W250056 以前）
    const legacy = all.filter(c => {
        const n = parseInt(c.contractNumber.replace(/\D/g, ''), 10);
        return isNaN(n) || n < 250056;
    });

    // Dashboard 顯示的筆數（非歷史、有申請日期）
    const displayed = all.filter(c => {
        if (!c.requestDate || c.requestDate.trim() === '') return false;
        const n = parseInt(c.contractNumber.replace(/\D/g, ''), 10);
        return !isNaN(n) && n >= 250056;
    });

    // 四個 Dashboard 卡片涵蓋的筆數
    const cardCovered = displayed.filter(c =>
        c.status === 'IN_REVIEW' ||
        c.status === 'AWAITING_FEEDBACK' ||
        c.stampInProgress ||
        c.isArchived
    );

    // 不在任何卡片的筆數
    const notInCards = displayed.filter(c =>
        c.status !== 'IN_REVIEW' &&
        c.status !== 'AWAITING_FEEDBACK' &&
        !c.stampInProgress &&
        !c.isArchived
    );

    return NextResponse.json({
        sheet_total: totalSheet,
        dashboard_displayed: displayed.length,
        card_total: cardCovered.length,
        not_in_any_card: notInCards.length,
        legacy_hidden: legacy.length,
        no_request_date: all.filter(c => !c.requestDate || c.requestDate.trim() === '').length,
        uncovered_contracts: notInCards.map(c => ({
            contractNumber: c.contractNumber,
            status: c.status,
            isArchived: c.isArchived,
            stampCompleted: c.stampCompleted,
            stampInProgress: c.stampInProgress,
            lastReplyDate: c.lastReplyDate,
        })),
    });
}
