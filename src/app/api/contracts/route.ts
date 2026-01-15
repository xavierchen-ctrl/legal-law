import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';

export async function POST(request: Request) {
    return NextResponse.json(
        { error: 'System is in Sync Mode (Read Only). Please add contracts in Google Sheets.' },
        { status: 403 }
    );
}

export async function GET() {
    try {
        const contracts = await fetchContractsFromSheet();
        return NextResponse.json(contracts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
    }
}
