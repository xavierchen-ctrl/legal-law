import { NextResponse } from 'next/server';
import { checkAndSendOverdueNotifications, checkAndSendArchiveReminders, checkAndSendFollowUpReminders, checkAndSendStampDoneReminders } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting Daily Check...');
        const [overdueResult, archiveResult, followUpResult, stampDoneResult] = await Promise.all([
            checkAndSendOverdueNotifications(),
            checkAndSendArchiveReminders(),
            checkAndSendFollowUpReminders(),
            checkAndSendStampDoneReminders(),
        ]);
        console.log('[Cron] Daily Check Complete:', { overdueResult, archiveResult, followUpResult, stampDoneResult });

        return NextResponse.json({ overdueResult, archiveResult, followUpResult, stampDoneResult });
    } catch (error) {
        console.error('[Cron] Daily Check Failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
