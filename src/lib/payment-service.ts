import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type DeviationType = 'UNFAVORABLE' | 'FAVORABLE' | 'NEUTRAL';
export type Recommendation = 'APPROVE' | 'ESCALATE' | 'REJECT';
export type OurRole = 'COLLECTOR' | 'PAYER' | 'AUTO';
export type ResolvedRole = 'COLLECTOR' | 'PAYER' | 'UNCLEAR';

export type SourceType =
    | 'CONTRACT_QUOTE'      // 直接引述合約條文
    | 'CONTRACT_INFERENCE'  // 從合約文字推論（非直接條文）
    | 'NOT_FOUND';          // 合約未約定 / 文字未提及

export interface ExtractionSource {
    sourceType: SourceType;
    sourceQuote: string | null; // 條文原文（CONTRACT_QUOTE 必填，其他可為 null）
    sourceNote: string;         // 來源說明（繁體中文，例：「第3條第2項」）
}

export interface PaymentTermExtracted {
    paymentPeriod: string;
    paymentMethod: string;
    paymentMilestones: string[];
    latePaymentPenalty: string | null;
    currency: string;
    otherTerms: string[];
}

export type ReferenceSourceType =
    | 'USER_HISTORICAL'   // 使用者貼入的「過往交易條件」
    | 'COMPANY_POLICY'    // 使用者貼入的「公司付款政策」
    | 'AI_ESTIMATE'       // AI 一般商業常識推估（無外部資料來源）
    | 'NONE';             // 無對應參考條件

export interface PaymentDeviation {
    field: string;
    currentValue: string;
    currentValueSource: string;     // 合約來源說明（如：「第3條」或「合約未約定」）
    referenceValue: string;
    referenceSourceType: ReferenceSourceType;
    referenceSourceNote: string;    // 參考來源說明（繁體中文）
    deviationType: DeviationType;
    riskDescription: string;
}

export interface PaymentCheckResult {
    extractedTerms: PaymentTermExtracted;
    extractionSources: {
        paymentPeriod: ExtractionSource;
        paymentMethod: ExtractionSource;
        paymentMilestones: ExtractionSource;
        latePaymentPenalty: ExtractionSource;
        currency: ExtractionSource;
    };
    resolvedRole: ResolvedRole;       // 本次分析所採用之我方角色
    roleResolution: string;            // 角色判斷說明（使用者指定 / AI 偵測）
    deviations: PaymentDeviation[];
    riskLevel: RiskLevel;
    overallAssessment: string;
    recommendation: Recommendation;
    approvalLevel: string | null;
    notificationRequired: boolean;
    summary: string;
    methodologyNote: string;           // 分析方法論說明（給使用者）
}

function rolePromptSection(ourRole: OurRole): string {
    if (ourRole === 'COLLECTOR') {
        return `
═══ 我方角色（使用者指定）═══
我方為「收款方」（receives payment from counterparty）。
風險方向判讀：
- 付款期限「縮短」（如 月結60天 → 月結30天）→ FAVORABLE（提早收款、改善現金流）
- 付款期限「延長」→ UNFAVORABLE（延後收款、現金流壓力增加）
- 預付／簽約付款比例提高 → FAVORABLE
- 高額尾款集中於驗收後 → UNFAVORABLE
- 逾期罰息保護我方 → FAVORABLE`;
    }
    if (ourRole === 'PAYER') {
        return `
═══ 我方角色（使用者指定）═══
我方為「付款方」（pays to counterparty）。
風險方向判讀：
- 付款期限「延長」→ FAVORABLE（延後付款、有利現金流）
- 付款期限「縮短」→ UNFAVORABLE（提早付款、現金流壓力）
- 預付／簽約付款比例提高 → UNFAVORABLE
- 高額尾款集中於驗收後 → FAVORABLE
- 逾期罰息（向我方收取）→ UNFAVORABLE`;
    }
    return `
═══ 我方角色（AI 自動判斷）═══
請先從合約文字判斷我方角色：
- 若合約中明確說明我方提供服務／交付商品並收取報酬 → 我方為「收款方」（COLLECTOR）
- 若合約中明確說明我方接受服務／購買商品並支付報酬 → 我方為「付款方」（PAYER）
- 若文字不明確，請於 resolvedRole 標示 "UNCLEAR" 並於 roleResolution 中說明判斷困難之原因
請於 resolvedRole 欄位回傳結論（COLLECTOR / PAYER / UNCLEAR），並依該角色判讀風險方向（規則同前段）。`;
}

function defaultExtractionSource(found: boolean): ExtractionSource {
    return found
        ? { sourceType: 'CONTRACT_QUOTE', sourceQuote: null, sourceNote: '' }
        : { sourceType: 'NOT_FOUND', sourceQuote: null, sourceNote: '合約未約定' };
}

export async function analyzePaymentTerms(
    contractText: string,
    historicalTerms: string,
    companyPolicy: string,
    transactionBackground: string,
    counterpartyType: 'existing' | 'new',
    ourRole: OurRole = 'AUTO',
    apiKey?: string
): Promise<PaymentCheckResult> {
    try {
        const historicalSection = historicalTerms.trim()
            ? `\n\n過往交易條件（使用者貼入）:\n"""\n${historicalTerms.substring(0, 3000)}\n"""`
            : '\n\n過往交易條件：使用者未提供。\n⚠️ 重要：若無過往條件，比較參考值僅能基於「公司政策」或「AI 一般商業常識推估」。若用 AI 推估，referenceSourceType 必須標 AI_ESTIMATE，並於 referenceSourceNote 明說「無使用者提供之過往條件，此為 AI 依一般商業常識推估」。不得偽造「過往條件月結X天」等具體數字而標示為使用者來源。';

        const policySection = companyPolicy.trim()
            ? `\n\n公司付款政策（使用者貼入）:\n"""\n${companyPolicy.substring(0, 2000)}\n"""`
            : '\n\n公司付款政策：使用者未提供。';

        const backgroundSection = transactionBackground.trim()
            ? `\n\n交易背景:\n"""\n${transactionBackground.substring(0, 1000)}\n"""`
            : '';

        const prompt = `
你是資深台灣法律與財務分析師，專精合約付款條款審查。

═══ 分析方法論（必須遵守）═══

1. 「擷取付款條件」必須直接基於合約文字。每一個擷取欄位都必須提供：
   - sourceType：CONTRACT_QUOTE（有原文）／CONTRACT_INFERENCE（從多處文字推論）／NOT_FOUND（合約未提及）
   - sourceQuote：若 CONTRACT_QUOTE，引述合約原文（10-80 字精準引述）；若 INFERENCE / NOT_FOUND，設為 null
   - sourceNote：以中文說明來源（如「第3條第2項」「合約未約定」「綜合第2、4條推論」）
   ⚠️ 嚴禁：在合約沒有對應文字時，憑空產生條件數值（例如未提及付款方式卻填「銀行電匯」）。若未約定，請填「未約定」並 sourceType=NOT_FOUND。

2. 「比較參考值」必須標示來源：
   - referenceSourceType: USER_HISTORICAL（使用者貼入的過往條件）／COMPANY_POLICY（使用者貼入的公司政策）／AI_ESTIMATE（AI 推估）／NONE
   - referenceSourceNote：明確說明參考值由何而來。例如「依使用者提供之過往條件」「依公司政策第X條」「AI 依一般商業常識推估，無外部資料佐證」
   ⚠️ 嚴禁：未經使用者提供過往條件，卻在 referenceValue 中寫出具體數字（如「過往條件月結60天」）並標示為使用者來源。

3. PDF 與 Word 解析可能產生細微差異，請盡量基於語意而非排版判讀。

${rolePromptSection(ourRole)}

═══ 合約內容（付款條款）═══
"""
${contractText.substring(0, 10000)}
"""
${historicalSection}
${policySection}
${backgroundSection}

═══ 相對人類型 ═══
${counterpartyType === 'existing' ? '既有客戶/廠商（Existing）' : '新客戶/廠商（New）'}

═══ 判斷規則 ═══
- 對 EXISTING 相對人：付款條件應與過往條件一致，任何偏離都應比對；若無使用者提供過往條件，請於 deviations 中明確標示 referenceSourceType=AI_ESTIMATE，並降低 riskLevel 信心度，於 methodologyNote 中說明
- 對 NEW 相對人：付款條件應符合公司政策；若無使用者提供政策，referenceSourceType=AI_ESTIMATE
- riskLevel：HIGH（嚴重不利我方且金額大／無救濟條款）、MEDIUM（中度不利但可控）、LOW（差異輕微或語意相同）
- recommendation：APPROVE（可接受）、ESCALATE（需上級核准）、REJECT（嚴重不可接受）

═══ 輸出格式 ═══
僅回傳純 JSON 物件（不加 markdown code block）：
{
  "extractedTerms": {
    "paymentPeriod": "如：月結30天 / 簽約後30日內 / 未約定",
    "paymentMethod": "如：銀行電匯 / 發票請款 / 未約定",
    "paymentMilestones": ["如：簽約付30%", "驗收後付70%"]，若無里程碑請回傳空陣列 [],
    "latePaymentPenalty": "如：逾期按日息0.05% / null（未約定）",
    "currency": "如：TWD / USD / 未約定",
    "otherTerms": ["其他付款相關條件，無則空陣列"]
  },
  "extractionSources": {
    "paymentPeriod":      { "sourceType": "CONTRACT_QUOTE | CONTRACT_INFERENCE | NOT_FOUND", "sourceQuote": "原文引述或 null", "sourceNote": "中文來源說明" },
    "paymentMethod":      { "sourceType": "...", "sourceQuote": "...", "sourceNote": "..." },
    "paymentMilestones":  { "sourceType": "...", "sourceQuote": "...", "sourceNote": "..." },
    "latePaymentPenalty": { "sourceType": "...", "sourceQuote": "...", "sourceNote": "..." },
    "currency":           { "sourceType": "...", "sourceQuote": "...", "sourceNote": "..." }
  },
  "resolvedRole": "COLLECTOR | PAYER | UNCLEAR",
  "roleResolution": "中文說明：如「使用者指定」或「AI 依合約第X條判斷我方為收款方」",
  "deviations": [
    {
      "field": "付款期間",
      "currentValue": "月結30天",
      "currentValueSource": "第3條",
      "referenceValue": "月結60天",
      "referenceSourceType": "USER_HISTORICAL | COMPANY_POLICY | AI_ESTIMATE | NONE",
      "referenceSourceNote": "依使用者提供之過往條件 / AI 依一般商業常識推估 等",
      "deviationType": "UNFAVORABLE | FAVORABLE | NEUTRAL",
      "riskDescription": "依我方角色說明影響。例如收款方角度：期限縮短有利於現金流，屬 FAVORABLE"
    }
  ],
  "riskLevel": "HIGH | MEDIUM | LOW",
  "overallAssessment": "整體評估說明（繁體中文，2-3 句，明確說明依何種角色判讀）",
  "recommendation": "APPROVE | ESCALATE | REJECT",
  "approvalLevel": "如：財務長核准 / null",
  "notificationRequired": true | false,
  "summary": "一段話摘要（繁體中文）",
  "methodologyNote": "本次分析的方法論說明：依何角色判讀、參考條件來自何處、若有 AI 推估之處，須說明"
}
所有文字欄位為繁體中文。若 deviations 無項目，回傳空陣列 []。
`;

        const raw = await callOpenAI(prompt, apiKey, 10000, true);
        console.log('[PaymentService] Raw AI output length:', raw.length);

        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');

        let parsed: any;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch {
            const repaired = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
            parsed = JSON.parse(repaired);
        }

        // 補齊缺漏欄位（向後兼容）
        const ensureSource = (s: any): ExtractionSource => s && typeof s === 'object'
            ? {
                sourceType: (s.sourceType ?? 'CONTRACT_INFERENCE') as SourceType,
                sourceQuote: s.sourceQuote ?? null,
                sourceNote: s.sourceNote ?? '',
            }
            : defaultExtractionSource(false);

        const result: PaymentCheckResult = {
            extractedTerms: parsed.extractedTerms ?? {
                paymentPeriod: '未約定', paymentMethod: '未約定', paymentMilestones: [], latePaymentPenalty: null, currency: '未約定', otherTerms: [],
            },
            extractionSources: {
                paymentPeriod:      ensureSource(parsed.extractionSources?.paymentPeriod),
                paymentMethod:      ensureSource(parsed.extractionSources?.paymentMethod),
                paymentMilestones:  ensureSource(parsed.extractionSources?.paymentMilestones),
                latePaymentPenalty: ensureSource(parsed.extractionSources?.latePaymentPenalty),
                currency:           ensureSource(parsed.extractionSources?.currency),
            },
            resolvedRole: (parsed.resolvedRole ?? 'UNCLEAR') as ResolvedRole,
            roleResolution: parsed.roleResolution ?? '',
            deviations: Array.isArray(parsed.deviations)
                ? parsed.deviations.map((d: any) => ({
                    field: d.field ?? '',
                    currentValue: d.currentValue ?? '',
                    currentValueSource: d.currentValueSource ?? '',
                    referenceValue: d.referenceValue ?? '',
                    referenceSourceType: (d.referenceSourceType ?? 'AI_ESTIMATE') as ReferenceSourceType,
                    referenceSourceNote: d.referenceSourceNote ?? '',
                    deviationType: (d.deviationType ?? 'NEUTRAL') as DeviationType,
                    riskDescription: d.riskDescription ?? '',
                }))
                : [],
            riskLevel: (parsed.riskLevel ?? 'MEDIUM') as RiskLevel,
            overallAssessment: parsed.overallAssessment ?? '',
            recommendation: (parsed.recommendation ?? 'ESCALATE') as Recommendation,
            approvalLevel: parsed.approvalLevel ?? null,
            notificationRequired: parsed.notificationRequired ?? false,
            summary: parsed.summary ?? '',
            methodologyNote: parsed.methodologyNote ?? '',
        };

        return result;

    } catch (error: any) {
        console.error('[PaymentService] Failed:', error);
        await logSystemEvent('PaymentService', 'ERROR', `Payment analysis failed: ${error.message}`);
        throw error;
    }
}
