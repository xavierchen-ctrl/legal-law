import { NextResponse } from 'next/server';
import { sendCeoUnclosedSummary } from '@/lib/notification-service';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting Weekly CEO Report...');
        const result = await sendCeoUnclosedSummary();
        console.log('[Cron] Weekly Report Complete:', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Cron] Weekly Report Failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
