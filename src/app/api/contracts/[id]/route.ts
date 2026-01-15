import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const contracts = await fetchContractsFromSheet();
        // Decode ID if needed, contract number is the ID
        const contract = contracts.find(c => c.id === decodeURIComponent(id));

        if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(contract);
    } catch (error) {
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    return NextResponse.json(
        { error: 'System is in Sync Mode (Read Only). Please update status in Google Sheets.' },
        { status: 403 }
    );
}
