import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

const cleanKey = (key: string | undefined) => (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type DeviationType = 'UNFAVORABLE' | 'FAVORABLE' | 'NEUTRAL';
export type Recommendation = 'APPROVE' | 'ESCALATE' | 'REJECT';

export interface PaymentTermExtracted {
    paymentPeriod: string;
    paymentMethod: string;
    paymentMilestones: string[];
    latePaymentPenalty: string | null;
    currency: string;
    otherTerms: string[];
}

export interface PaymentDeviation {
    field: string;
    currentValue: string;
    referenceValue: string;
    deviationType: DeviationType;
    riskDescription: string;
}

export interface PaymentCheckResult {
    extractedTerms: PaymentTermExtracted;
    deviations: PaymentDeviation[];
    riskLevel: RiskLevel;
    overallAssessment: string;
    recommendation: Recommendation;
    approvalLevel: string | null;
    notificationRequired: boolean;
    summary: string;
}

export async function analyzePaymentTerms(
    contractText: string,
    historicalTerms: string,
    companyPolicy: string,
    transactionBackground: string,
    counterpartyType: 'existing' | 'new',
    apiKey?: string
): Promise<PaymentCheckResult> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    if (!effectiveKey) throw new Error('Missing GEMINI_API_KEY');

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const historicalSection = historicalTerms.trim()
            ? `\n\nHistorical Payment Terms (過往交易條件):\n"""\n${historicalTerms.substring(0, 3000)}\n"""`
            : '\n\nHistorical Payment Terms: Not provided (treat as new counterparty).';

        const policySection = companyPolicy.trim()
            ? `\n\nCompany Payment Policy (公司內部付款政策):\n"""\n${companyPolicy.substring(0, 2000)}\n"""`
            : '\n\nCompany Payment Policy: Not provided. Apply general commercial prudence.';

        const backgroundSection = transactionBackground.trim()
            ? `\n\nTransaction Background (交易背景):\n"""\n${transactionBackground.substring(0, 1000)}\n"""`
            : '';

        const prompt = `
You are a senior legal and finance analyst specializing in contract payment terms review for a Taiwanese company.

CRITICAL PERSPECTIVE: 我方 (our company) is the SERVICE PROVIDER / CONTRACTOR (乙方) — we perform work or deliver services and RECEIVE payment from the counterparty (甲方, the client/buyer). All risk assessments must be made from the service provider's perspective (收款方視角).

Your task is to:
1. Extract the payment terms from the contract
2. Compare them against historical terms and company policy
3. Identify any deviations that are unfavorable to us AS THE PARTY RECEIVING PAYMENT
4. Provide a clear recommendation

Counterparty Type: ${counterpartyType === 'existing' ? '既有客戶/廠商 (Existing)' : '新客戶/新廠商 (New)'}

Contract Text (合約付款條款):
"""
${contractText.substring(0, 10000)}
"""
${historicalSection}
${policySection}
${backgroundSection}

Analysis Rules (from service provider / 收款方 perspective):
- UNFAVORABLE to us (乙方): long payment periods (>60 days after delivery/acceptance), no late payment penalty clause, payment entirely deferred to acceptance with no milestone payments, no interest on overdue amounts, overly broad payment withholding rights for client
- FAVORABLE to us (乙方): upfront payments or milestone payments before full delivery, clear late payment penalties protecting us, payment tied to objective milestones rather than subjective client satisfaction, short payment periods
- Do NOT flag upfront or pre-delivery payments as risks to us — receiving payment early is favorable, not a risk
- For EXISTING counterparties: payment terms must match historical terms; any deviation is flagged
- For NEW counterparties: payment terms must comply with company policy
- Flag as HIGH risk: payment entirely post-delivery with >60 day period AND no late payment penalty, payment contingent on vague or subjective conditions, unusual currency without hedging, unilateral right to withhold payment
- Flag as MEDIUM risk: minor deviations from standard terms, short payment periods but no penalty clause
- Flag as LOW risk: minor wording differences with same legal effect
- "ESCALATE" if HIGH risk deviations exist or if amount suggests senior approval needed
- "REJECT" if terms are clearly unacceptable (e.g., payment >120 days post-acceptance with no milestones, no recourse for non-payment)
- "APPROVE" if terms are within acceptable range

Output Format:
Return ONLY a raw JSON object (no markdown). Structure:
{
    "extractedTerms": {
        "paymentPeriod": "e.g. 月結60天 / Net 30 / 簽約後30日內",
        "paymentMethod": "e.g. 銀行電匯 / 支票 / 信用狀",
        "paymentMilestones": ["e.g. 簽約付30%", "驗收後付70%"],
        "latePaymentPenalty": "e.g. 逾期按日息0.05%計罰 or null if not specified",
        "currency": "e.g. TWD / USD",
        "otherTerms": ["any other notable payment-related terms"]
    },
    "deviations": [
        {
            "field": "付款期間",
            "currentValue": "月結90天",
            "referenceValue": "月結60天（過往條件）",
            "deviationType": "UNFAVORABLE",
            "riskDescription": "付款期間延長30天，我方需等更久才能收款，現金流壓力增加"
        }
    ],
    "riskLevel": "HIGH" | "MEDIUM" | "LOW",
    "overallAssessment": "整體評估說明（繁體中文，2-3句，從乙方收款視角說明）",
    "recommendation": "APPROVE" | "ESCALATE" | "REJECT",
    "approvalLevel": "e.g. 財務長核准 / 總經理核准 / null if APPROVE",
    "notificationRequired": true | false,
    "summary": "一段話摘要（繁體中文），供需求單位及財務單位快速了解，須明確說明我方（乙方）的收款條件與風險"
}

The "deviations" array should be empty [] if no deviations found.
All text fields must be in Traditional Chinese (繁體中文).
`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('[PaymentService] Raw AI output length:', responseText.length);
        const parsed = JSON.parse(responseText) as PaymentCheckResult;
        return parsed;

    } catch (error: any) {
        console.error('[PaymentService] Failed:', error);
        await logSystemEvent('PaymentService', 'ERROR', `Payment analysis failed: ${error.message}`);
        throw error;
    }
}
