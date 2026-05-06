import { NextResponse } from 'next/server';
import { compareContractVersions } from '@/lib/diff-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { versionA, versionB, reviewComments = '' } = body;

        if (!versionA || versionA.trim().length < 10) {
            return NextResponse.json({ error: '請提供舊版合約文字（versionA）。' }, { status: 400 });
        }
        if (!versionB || versionB.trim().length < 10) {
            return NextResponse.json({ error: '請提供新版合約文字（versionB）。' }, { status: 400 });
        }

        console.log(`[Diff API] versionA: ${versionA.length} chars, versionB: ${versionB.length} chars`);

        const result = await compareContractVersions(
            versionA.trim(),
            versionB.trim(),
            reviewComments.trim()
        );

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('[API /contract-diff] Error:', error);
        return NextResponse.json(
            { error: `比對失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
