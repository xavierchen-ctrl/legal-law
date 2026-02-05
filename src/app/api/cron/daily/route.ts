import { NextResponse } from 'next/server';
import { checkAndSendOverdueNotifications } from '@/lib/notification-service';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting Daily Check...');
        const result = await checkAndSendOverdueNotifications();
        console.log('[Cron] Daily Check Complete:', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Cron] Daily Check Failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
