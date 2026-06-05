import { NextRequest, NextResponse } from 'next/server';
import { scanAndNotify } from '@/lib/scanner';
import { logSystemEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get('x-openai-api-key') || undefined;

        console.log(`[Manual Scan] Triggered. Custom Key Provided: ${!!apiKey}`);
        await logSystemEvent('Manual_Scan', 'INFO', `User triggered scan. Custom Key: ${!!apiKey}`);

        // Run Scan (limit to 20 files for manual run to check latest)
        // Note: scanAndNotify is an async operation that might take time.
        // For a better UX, we might want to run it in background, but the user wants to see results?
        // Let's await it for now but with a limit.
        const result = await scanAndNotify({ limit: 20, apiKey });

        return NextResponse.json({
            success: true,
            message: 'Manual scan completed.',
            details: result
        });

    } catch (error: any) {
        console.error('Manual Scan Failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
