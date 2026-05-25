import { NextRequest, NextResponse } from 'next/server';
import { draftDocument, rewriteClause } from '@/lib/drafting-service';
import type { DraftRequest, RewriteRequest } from '@/lib/drafting-service';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (body.rewriteMode) {
            const { clauseTitle, originalContent, rewriteGoal } = body as RewriteRequest;
            if (!clauseTitle || !originalContent || !rewriteGoal) {
                return NextResponse.json({ error: '請填寫條文標題、原始內容及改寫方向' }, { status: 400 });
            }
            const result = await rewriteClause({ clauseTitle, originalContent, rewriteGoal });
            return NextResponse.json({ result });
        }

        const { documentType, caseBackground, businessModel, companyPosition, riskPreference } = body as DraftRequest;
        if (!documentType || !caseBackground || !businessModel || !companyPosition || !riskPreference) {
            return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 });
        }
        const result = await draftDocument(body as DraftRequest);
        return NextResponse.json({ result });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
