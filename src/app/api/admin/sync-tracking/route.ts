import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type TrackingStatus = 'REVIEWING' | 'REPLIED' | 'PENDING_STAMP' | 'ARCHIVED';
const STATUS_ORDER: TrackingStatus[] = ['REVIEWING', 'REPLIED', 'PENDING_STAMP', 'ARCHIVED'];

function deriveStatus(sheetStatus: string, isArchived: boolean, stampCompleted: boolean, stampInProgress: boolean): TrackingStatus {
    if (isArchived || stampCompleted || sheetStatus === 'CLOSED') return 'ARCHIVED';
    if (stampInProgress) return 'PENDING_STAMP';
    if (sheetStatus === 'AWAITING_FEEDBACK') return 'REPLIED';
    return 'REVIEWING';
}

export async function POST(request: Request) {
    const { contractNumber } = await request.json();
    if (!contractNumber) return NextResponse.json({ error: '請提供合約編號' }, { status: 400 });

    const contracts = await fetchContractsFromSheet();
    const contract = contracts.find(c => c.contractNumber === contractNumber);
    if (!contract) return NextResponse.json({ error: `找不到合約 ${contractNumber}` }, { status: 404 });

    const target = deriveStatus(contract.status, contract.isArchived, contract.stampCompleted, contract.stampInProgress);

    const existing = await prisma.contractTracking.findUnique({ where: { contractNumber } });
    const dbStatus = existing?.trackingStatus as TrackingStatus | undefined ?? 'REVIEWING';
    const dbIdx = STATUS_ORDER.indexOf(dbStatus);
    const targetIdx = STATUS_ORDER.indexOf(target);

    if (targetIdx <= dbIdx) {
        return NextResponse.json({
            message: '不需要同步（DB 狀態已是最新或更前面）',
            current: dbStatus,
            target,
        });
    }

    const now = new Date();
    const patch: Record<string, unknown> = { trackingStatus: target };
    if (targetIdx >= 1 && !existing?.repliedAt)       patch.repliedAt = now;
    if (targetIdx >= 2 && !existing?.stampRequestedAt) patch.stampRequestedAt = now;
    if (targetIdx >= 3 && !existing?.archivedAt)       patch.archivedAt = now;

    const updated = await prisma.contractTracking.upsert({
        where: { contractNumber },
        create: { contractNumber, reviewingAt: now, ...patch },
        update: patch,
    });

    return NextResponse.json({
        success: true,
        message: `已同步 ${contractNumber}：${dbStatus} → ${target}`,
        tracking: updated,
    });
}
