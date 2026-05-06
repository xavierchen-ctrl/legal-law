import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskClassification = 'MUST_FIX' | 'ACCEPTABLE';
export type SigningRec = 'APPROVE' | 'APPROVE_WITH_MODIFICATIONS' | 'REJECT';

export interface RiskItem {
    id: number;
    category: string;
    description: string;
    level: RiskLevel;
    classification: RiskClassification;
    actualImpact: string;
}

export interface InternalExplanation {
    summary: string;
    keyPoints: string[];
    revisionSuggestions: string[];
    riskReminders: string[];
}

export interface SigningRecommendation {
    recommendation: SigningRec;
    unacceptableRisks: string[];
    acceptableRisks: string[];
    commercialBenefits: string[];
    requiredModifications: string[];
    rationale: string;
}

export interface ContractReportResult {
    riskSummary: {
        overallRisk: RiskLevel;
        items: RiskItem[];
        conclusion: string;
    };
    internalExplanation: InternalExplanation;
    signingRecommendation: SigningRecommendation;
}

export async function generateContractReport(
    contractText: string,
    reviewNotes: string,
    businessBackground: string,
    apiKey?: string
): Promise<ContractReportResult> {
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
    if (!effectiveKey) throw new Error('Missing GEMINI_API_KEY');

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const reviewSection = reviewNotes.trim()
            ? `\n\nReview Notes / Previous Analysis (審閱結果與修訂建議):\n"""\n${reviewNotes.substring(0, 6000)}\n"""`
            : '';

        const backgroundSection = businessBackground.trim()
            ? `\n\nBusiness Background (商業背景與需求):\n"""\n${businessBackground.substring(0, 2000)}\n"""`
            : '';

        const prompt = `
You are a senior legal counsel generating a comprehensive contract review report for a Taiwanese company's internal decision-makers.

CRITICAL PERSPECTIVE: 我方 (our company) is the SERVICE PROVIDER / CONTRACTOR (乙方) — we perform work or deliver services and RECEIVE payment from the counterparty (甲方, the client/buyer). All risk assessments, impacts, and recommendations must be evaluated from the service provider's (乙方/收款方) perspective. Do NOT analyze risks as if we are the paying party.

Generate a report with THREE distinct sections based on the inputs below.

Contract Text:
"""
${contractText.substring(0, 12000)}
"""
${reviewSection}
${backgroundSection}

===== SECTION 1: Risk Summary (風險彙整報告) =====
- Identify all significant risks from the contract, assessed from our position as the service provider (乙方)
- Classify each as HIGH / MEDIUM / LOW
- Classify each as "MUST_FIX" (must be modified before signing) or "ACCEPTABLE" (can proceed with awareness)
- Explain the actual practical impact to us as the party performing work and receiving payment

===== SECTION 2: Internal Explanation (內部說明) =====
- Write for non-legal readers (business units, management)
- Use simple, everyday language — avoid legal jargon
- Bullet-point format
- Cover: what the contract requires us (乙方) to do, key risks to us as service provider in plain language, what needs to change, what to watch out for

===== SECTION 3: Signing Recommendation (簽署建議) =====
- Weigh risks against commercial benefits from our (乙方) perspective
- Clearly separate unacceptable risks vs acceptable risks to us as service provider
- Provide a clear recommendation: APPROVE / APPROVE_WITH_MODIFICATIONS / REJECT
- If APPROVE_WITH_MODIFICATIONS: list exactly what must be fixed to protect our interests as service provider
- Balance legal risk with business reality

Output Format:
Return ONLY a raw JSON object (no markdown). All text in Traditional Chinese (繁體中文):
{
    "riskSummary": {
        "overallRisk": "HIGH" | "MEDIUM" | "LOW",
        "conclusion": "2-3 sentence overall risk conclusion",
        "items": [
            {
                "id": 1,
                "category": "e.g. 責任限制 / 付款條件 / 終止條款",
                "description": "Clear description of the risk",
                "level": "HIGH" | "MEDIUM" | "LOW",
                "classification": "MUST_FIX" | "ACCEPTABLE",
                "actualImpact": "What actually happens if this risk materializes — in plain, concrete terms"
            }
        ]
    },
    "internalExplanation": {
        "summary": "1-2 sentence plain-language summary of what this contract is and its overall status",
        "keyPoints": ["Key point 1 in simple language", "Key point 2..."],
        "revisionSuggestions": ["Suggested revision 1", "Suggested revision 2..."],
        "riskReminders": ["Important thing to watch out for 1", "..."]
    },
    "signingRecommendation": {
        "recommendation": "APPROVE" | "APPROVE_WITH_MODIFICATIONS" | "REJECT",
        "unacceptableRisks": ["Risk that must be resolved before signing"],
        "acceptableRisks": ["Risk we can live with and why"],
        "commercialBenefits": ["Business benefit that justifies proceeding"],
        "requiredModifications": ["Specific clause change required (only if APPROVE_WITH_MODIFICATIONS)"],
        "rationale": "2-3 sentence explanation of the recommendation balancing risk and business need"
    }
}
`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('[ReportService] Raw AI output length:', responseText.length);
        const parsed = JSON.parse(responseText) as ContractReportResult;
        return parsed;

    } catch (error: any) {
        console.error('[ReportService] Failed:', error);
        await logSystemEvent('ReportService', 'ERROR', `Report generation failed: ${error.message}`);
        throw error;
    }
}
