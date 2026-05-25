
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

const cleanKey = (key: string | undefined) => (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();


export interface AIRule {
    ruleName: string;
    promptInstruction: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    targetEmail: string;
}

export interface AIAnalysisResult {
    ruleId: number;
    violationFound: boolean;
    reasoning: string;
}

/**
 * Validates connectivity to Gemini API
 */
export async function testGeminiConnection(apiKey?: string): Promise<boolean> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    if (!effectiveKey) {
        console.error('GEMINI_API_KEY is not set');
        return false;
    }
    try {
        const genAI = new GoogleGenerativeAI(effectiveKey as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent('Say "Hello World" if you can hear me.');
        const response = result.response;
        const text = response.text();
        console.log('Gemini Test Response:', text);
        return text.toLowerCase().includes('hello');
    } catch (error) {
        console.error('Gemini Connection Failed:', error);
        return false;
    }
}

/**
 * Analyzes contract text against a set of rules
 */
export async function analyzeContractWithAI(text: string, rules: AIRule[], apiKey?: string): Promise<AIAnalysisResult[]> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);

    if (!effectiveKey) {
        await logSystemEvent('AI_Service', 'ERROR', 'Missing GEMINI_API_KEY');
        return [];
    }

    if (rules.length === 0) return [];

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        // Construct Prompt
        const rulesText = rules.map((r, i) => `
        ID: ${i}
        Name: ${r.ruleName}
        Instruction: ${r.promptInstruction}
        ----------------------------------
        `).join('\n');

        const prompt = `
        You are a senior Legal AI Assistant for "潮網科技 (Wavenet)".
        Analyze the following contract text and check for violations of the specified rules.
        
        Input Contract Text:
        """
        ${text.substring(0, 5000)} 
        """
        (Text truncated to first 5k chars for efficiency)

        Rules to Check:
        ${rulesText}

        Output Format:
        Return ONLY a raw JSON array (no markdown code blocks) with the following structure:
        [
            {
                "ruleId": 0, // The Integer ID from the Rules list above
                "violationFound": true/false,
                "reasoning": "Explanation of why it violates or passes (in Traditional Chinese)"
            }
        ]
        `;

        // ... Prompt Construction ...

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                let responseText = response.text();

                // Clean markdown code blocks if present
                responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log('🤖 AI Raw output:', responseText);

                const analysis = JSON.parse(responseText) as AIAnalysisResult[];
                return analysis;

            } catch (error: any) {
                if (error.message?.includes('429') || error.status === 429) {
                    retryCount++;
                    if (retryCount > maxRetries) throw error;
                    const delay = Math.pow(2, retryCount) * 5000; // 10s, 20s, 40s
                    console.log(`⚠️ 429 Too Many Requests. Retrying in ${delay / 1000}s... (Attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // Rethrow non-429 errors
                }
            }
        }
        return []; // Should not reach here
    } catch (error: any) {
        console.error('AI Analysis Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Analysis failed: ${error.message}`);

        // Throw error to let caller know (especially for manual scans/quota limit)
        throw error;
    }
}

export interface ArchitectureReviewItem {
    id: number;
    category: string;
    title: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    detail: string;
}

/**
 * Perform a 5-point architecture review of the contract text
 */
export async function analyzeContractArchitecture(text: string, apiKey?: string): Promise<ArchitectureReviewItem[]> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);

    if (!effectiveKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const prompt = `
        You are a senior Legal AI Assistant for a Taiwanese company.
        Please perform a comprehensive contract architecture review based on the provided contract text.
        Your review MUST evaluate the following 5 target criteria:

        1. 是否具備基本交易條款（標的、權利義務、付款條件）
        2. 是否具備風險分配條款（保密、責任、違約）
        3. 是否具備一般條款（準據法、爭議解決、終止）
        4. 條款間是否前後一致、無矛盾
        5. 是否有重要條款缺漏（如責任限制或終止條款）

        Input Contract Text:
        """
        ${text.substring(0, 30000)} // Deep review needs more context
        """

        Output Format:
        Return ONLY a raw JSON array (do not wrap in markdown code blocks like \`\`\`json) with exactly 5 objects corresponding to the 5 criteria above.
        Format for each object:
        {
            "id": number (1 to 5),
            "category": "Short title of the criteria (e.g. '基本交易條款')",
            "title": "Full description of the criteria",
            "status": "PASS" (all good), "WARN" (some issues or minor overlaps), or "FAIL" (missing or contradictions),
            "detail": "Detailed explanation of your findings in Traditional Chinese (繁體中文). Explain what was found, what is missing, or where contradictions occur."
        }
        `;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('🤖 AI Architecture Review Raw output:', responseText);

        const analysis = JSON.parse(responseText) as ArchitectureReviewItem[];
        return analysis;

    } catch (error: any) {
        console.error('AI Architecture Review Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Architecture Review failed: ${error.message}`);
        throw error;
    }
}

export type FindingType = 'MAJOR_RISK' | 'GENERAL_RISK' | 'OPTIMIZATION' | 'DRAFTING' | 'PASS';

export interface NamePreambleReviewItem {
    id: number;
    category: string;
    title: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    findingType: FindingType;
    detail: string;
    suggestion: string | null;
}

export interface NamePreambleReviewResult {
    items: NamePreambleReviewItem[];
    suggestedName: string | null;
    suggestedPreamble: string | null;
    overallAssessment: string;
    trackChangesDetected: boolean;
    trackChangesWarning: string | null;
}

export interface NamePreambleCaseContext {
    businessBackground?: string;
    isCounterpartyTemplate?: boolean;
    hasNegotiationLeverage?: boolean;
    departmentNotes?: string;
}

export async function reviewContractNameAndPreamble(
    text: string,
    caseContext?: NamePreambleCaseContext,
    apiKey?: string
): Promise<NamePreambleReviewResult> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    if (!effectiveKey) throw new Error('Missing GEMINI_API_KEY');

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const contextSection = caseContext && (
            caseContext.businessBackground || caseContext.isCounterpartyTemplate !== undefined ||
            caseContext.hasNegotiationLeverage !== undefined || caseContext.departmentNotes
        ) ? `
Case Context (provided by legal team — factor this into your analysis):
- Business background / collaboration context: ${caseContext.businessBackground || '(not provided)'}
- Is this the counterparty's standard template: ${caseContext.isCounterpartyTemplate === true ? 'YES — adjustments may face resistance; flag critical issues only' : caseContext.isCounterpartyTemplate === false ? 'NO — our draft or jointly negotiated' : '(not specified)'}
- Has negotiation leverage to request amendments: ${caseContext.hasNegotiationLeverage === true ? 'YES — flag all improvable items' : caseContext.hasNegotiationLeverage === false ? 'NO — focus on MAJOR_RISK items only' : '(not specified)'}
- Requesting department notes: ${caseContext.departmentNotes || '(none)'}
` : '';

        const prompt = `You are a senior Taiwanese legal counsel specializing in contract review.

═══ STEP 1: TRACK CHANGES DETECTION ═══
Before analyzing, scan the contract text for Track Changes / comment markers:
- Strikethrough or deletion markers: ~~text~~, ---text---, [DELETED:...], (del:...), w:del artifacts
- Insertion markers: [INSERTED:...], [ADD:...], w:ins artifacts
- Comment/annotation markers: [Comment:...], <!--...-->, {NOTE:...}, COMMENT(...)
- Revision identifiers: REVISION, TRACKED, redline, markup language remnants

If such markers are found: set trackChangesDetected=true and explain in trackChangesWarning what was found and that the analysis is based on the apparent final/accepted text only (tracked deletions are ignored).
If none found: trackChangesDetected=false, trackChangesWarning=null.
${contextSection}
═══ STEP 2: CONTRACT TEXT ═══
"""
${text.substring(0, 20000)}
"""

═══ STEP 3: REVIEW CRITERIA ═══
Analyze the contract name and preamble on exactly 5 criteria:
1. 契約名稱是否與實際交易內容一致（名稱反映的法律關係是否符合條款實質）
2. 前言是否正確描述合作目的與交易架構（背景、目的、當事人角色）
3. 契約名稱與條款內容是否一致（避免名稱標榜甲方不承擔責任但條款卻相反）
4. 是否使用不精確或誤導性用語（如誤用「合作」代替「委託」、「顧問」代替「僱傭」）
5. 名稱或前言是否可能影響後續法律解釋或責任認定（如勞動/承攬爭議、稅務定性）

═══ STEP 4: FINDING TYPE CLASSIFICATION ═══
For each non-PASS item, assign a findingType — be conservative, do NOT over-classify:
- MAJOR_RISK (重大法律風險): Only if the issue could affect contract validity/enforceability, create serious unintended liability, cause a legal status misclassification (e.g. employment vs. contract-for-service), or expose a party to regulatory/tax consequences. This should be rare.
- GENERAL_RISK (一般風險提醒): Moderate concern worth noting — minor ambiguity, incomplete description, or potential (but not certain) dispute trigger.
- OPTIMIZATION (條文優化): Could be clearer, more precise, or more complete, but poses no real legal risk.
- DRAFTING (起草建議): Stylistic preference, conventional phrasing, or minor drafting convention — not a risk.
For PASS items, set findingType: "PASS".

═══ OUTPUT FORMAT ═══
Return ONLY a raw JSON object (no markdown):
{
    "trackChangesDetected": false,
    "trackChangesWarning": null,
    "overallAssessment": "2-3 sentence overall assessment in Traditional Chinese",
    "suggestedName": "Suggested corrected name or null",
    "suggestedPreamble": "Suggested corrected preamble or null",
    "items": [
        {
            "id": 1,
            "category": "Short category label",
            "title": "Full criterion description",
            "status": "PASS",
            "findingType": "PASS",
            "detail": "Detailed findings in Traditional Chinese — quote problematic text if any",
            "suggestion": null
        }
    ]
}
Return exactly 5 items in order.`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('[NamePreambleReview] Raw AI output length:', responseText.length);
        const parsed = JSON.parse(responseText) as NamePreambleReviewResult;
        return parsed;

    } catch (error: any) {
        console.error('Name & Preamble Review Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Name & Preamble Review failed: ${error.message}`);
        throw error;
    }
}

