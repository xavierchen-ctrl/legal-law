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

        const draft = body as DraftRequest;
        if (!draft.documentType || !draft.riskPreference) {
            return NextResponse.json({ error: '請選擇文件類型與風險偏好。' }, { status: 400 });
        }

        const isLetter = [
            'REPLY_LETTER', 'COMPANY_LETTER', 'FORMAL_LETTER',
            'REGISTERED_LETTER', 'COMPLAINT_LETTER',
        ].includes(draft.documentType);

        if (isLetter) {
            // 函文／檢舉函類：至少需要案件事實或案件背景之一（避免完全空白即起草）
            const hasFacts = (draft.factSummary?.trim().length ?? 0) >= 20
                || (draft.caseBackground?.trim().length ?? 0) >= 20
                || (draft.referenceDocuments?.length ?? 0) > 0;
            if (!hasFacts) {
                return NextResponse.json({
                    error: '函文／檢舉函類：請至少填寫「案件事實」或「案件背景」（20 字以上），或上傳參考資料。',
                }, { status: 400 });
            }
        } else {
            // 契約類：保留原欄位要求
            if (!draft.caseBackground || !draft.businessModel || !draft.companyPosition) {
                return NextResponse.json({ error: '請填寫案件背景、商務模式與公司立場。' }, { status: 400 });
            }
        }

        const result = await draftDocument(draft);
        return NextResponse.json({ result });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
