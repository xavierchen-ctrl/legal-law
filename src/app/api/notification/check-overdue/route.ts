import { NextResponse } from 'next/server';
import { checkAndSendOverdueNotifications } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';

export async function GET() {
    const result = await checkAndSendOverdueNotifications();

    if (result.success) {
        return NextResponse.json(result);
    } else {
        return NextResponse.json({ error: 'Check failed', details: result.error }, { status: 500 });
    }
}
