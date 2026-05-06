import { NextResponse } from 'next/server';
import { verifyCompanyWithGcis } from '@/lib/gcis-service';

/**
 * POST /api/gcis-verify
 * Body: { companyName: string, businessNo?: string }
 * 手動觸發 GCIS 商工資料比對
 */
export async function POST(request: Request) {
    try {
        const { companyName, businessNo } = await request.json();

        if (!companyName && !businessNo) {
            return NextResponse.json(
                { error: '請提供公司名稱或統一編號' },
                { status: 400 }
            );
        }

        const result = await verifyCompanyWithGcis(companyName ?? '', businessNo);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API /gcis-verify] Error:', error);
        return NextResponse.json(
            { error: `查詢失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
