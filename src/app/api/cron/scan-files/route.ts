import { NextResponse } from 'next/server';
import { scanAndNotify } from '@/lib/scanner';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Strict Auth Check
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const result = await scanAndNotify();
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Scan failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
