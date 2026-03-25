
import { NextResponse } from 'next/server';
import { getScanResults, updateScanStatus } from '../../../lib/keyword-service';

export async function GET() {
    try {
        const results = await getScanResults();
        // Filter out files that had no matches (matches === 'None')
        // We only want to show files that actually hit a keyword or AI rule.
        const flaggedResults = results.filter(r => r.matches !== 'None' && r.matches !== '');
        
        // Sort by newest first
        return NextResponse.json(flaggedResults.reverse());
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
