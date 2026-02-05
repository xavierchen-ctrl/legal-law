
import { NextResponse } from 'next/server';
import { getScanResults, updateScanStatus } from '../../../lib/keyword-service';

export async function GET() {
    try {
        const results = await getScanResults();
        // Sort by timestamp desc (newest first)
        // Note: Timestamp format is locale string, might need parsing if sorting is critical, 
        // but for now relying on Sheet order (append) or simple reverse.
        // Let's just reverse to show newest first if Sheet appends.
        return NextResponse.json(results.reverse());
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { fileId, status } = await request.json();

        if (!fileId || !status) {
            return NextResponse.json({ error: 'Missing fileId or status' }, { status: 400 });
        }

        await updateScanStatus(fileId, status);
        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
}
