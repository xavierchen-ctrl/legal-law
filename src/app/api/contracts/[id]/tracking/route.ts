import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

const DATE_FIELDS = ['reviewingAt', 'repliedAt', 'stampRequestedAt', 'archivedAt', 'lastArchiveReminderAt'] as const;

function parseDates(body: Record<string, unknown>) {
    const data = { ...body };
    for (const field of DATE_FIELDS) {
        if (typeof data[field] === 'string') {
            data[field] = new Date(data[field] as string);
        }
    }
    return data;
}

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const contractNumber = decodeURIComponent(id);

    try {
        const tracking = await prisma.contractTracking.findUnique({
            where: { contractNumber },
        });
        return NextResponse.json(tracking);
    } catch (err) {
        console.error('[tracking GET]', err);
        return NextResponse.json(null);
    }
}

export async function PATCH(request: Request, { params }: Params) {
    const { id } = await params;
    const contractNumber = decodeURIComponent(id);

    const body = await request.json();
    const data = parseDates(body);

    try {
        const tracking = await prisma.contractTracking.upsert({
            where: { contractNumber },
            create: {
                contractNumber,
                reviewingAt: new Date(),
                ...data,
            },
            update: data,
        });
        return NextResponse.json(tracking);
    } catch (err) {
        console.error('[tracking PATCH]', err);
        return NextResponse.json({ error: '更新失敗' }, { status: 500 });
    }
}
