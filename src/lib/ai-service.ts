import { logSystemEvent } from './logger';
import { callOpenAI, getOpenAIClient, OPENAI_MODEL } from './openai-client';

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

export async function testAIConnection(apiKey?: string): Promise<boolean> {
    try {
        const client = getOpenAIClient(apiKey);
        const response = await client.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Say "Hello World" if you can hear me.' }],
        });
        const text = response.choices[0]?.message?.content ?? '';
        console.log('OpenAI Test Response:', text);
        return text.toLowerCase().includes('hello');
    } catch (error) {
        console.error('OpenAI Connection Failed:', error);
        return false;
    }
}

export { testAIConnection as testGeminiConnection };

export async function analyzeContractWithAI(text: string, rules: AIRule[], apiKey?: string): Promise<AIAnalysisResult[]> {
    if (rules.length === 0) return [];

    try {
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

        const raw = await callOpenAI(prompt, apiKey, 8000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('🤖 AI Raw output:', cleaned.substring(0, 200));

        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!arrayMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(arrayMatch[0]) as AIAnalysisResult[];

    } catch (error: any) {
        console.error('AI Analysis Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Analysis failed: ${error.message}`);
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

export async function analyzeContractArchitecture(text: string, apiKey?: string): Promise<ArchitectureReviewItem[]> {
    try {
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
        ${text.substring(0, 30000)}
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

        const raw = await callOpenAI(prompt, apiKey, 6000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('🤖 AI Architecture Review Raw output length:', cleaned.length);

        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!arrayMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(arrayMatch[0]) as ArchitectureReviewItem[];

    } catch (error: any) {
        console.error('AI Architecture Review Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Architecture Review failed: ${error.message}`);
        throw error;
    }
}

export interface DocumentInput {
    label: string;
    text: string;
    version?: string;
}

export async function analyzeContractArchitectureMulti(
    docs: DocumentInput[],
    apiKey?: string
): Promise<ArchitectureReviewItem[]> {
    const isMulti = docs.length > 1;
    const charPerDoc = Math.min(8000, Math.floor(40000 / docs.length));

    const docsSection = docs.map((d, i) =>
        `--- 文件 ${i + 1}：${d.label}${d.version ? `（${d.version}）` : ''} ---\n"""\n${d.text.substring(0, charPerDoc)}\n"""`
    ).join('\n\n');

    const criteriaList = `1. 基本交易條款完整性（標的、權利義務、付款條件）
2. 風險分配條款（保密、責任、違約）
3. 一般條款（準據法、爭議解決、終止）
4. 條款前後一致性${isMulti ? '（含文件間交叉一致性）' : ''}
5. 重要條款缺漏（責任限制、終止條款等）${isMulti ? `
6. 文件間矛盾與衝突（主約與附件間的定義衝突、義務矛盾、付款條件不一致等）` : ''}`;

    const itemCount = isMulti ? 6 : 5;

    const prompt = `你是資深台灣法律顧問，專精合約架構審查。

請針對以下${isMulti ? `合約文件套件（共 ${docs.length} 份文件）` : '合約文字'}進行完整架構檢視：
${isMulti ? `\n文件清單：\n${docs.map((d, i) => `${i + 1}. ${d.label}${d.version ? `（${d.version}）` : ''}`).join('\n')}\n` : ''}
${docsSection}

請評估以下 ${itemCount} 項標準：
${criteriaList}

輸出格式：
僅回傳純 JSON 陣列（不加 markdown code block），包含 ${itemCount} 個物件：
[
  {
    "id": 1,
    "category": "評估項目短標題（如：基本交易條款）",
    "title": "評估項目完整描述",
    "status": "PASS" | "WARN" | "FAIL",
    "detail": "詳細說明（繁體中文）：發現什麼、缺少什麼、或矛盾在哪裡"
  }
]
`;

    try {
        const raw = await callOpenAI(prompt, apiKey, 8000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[ArchReviewMulti] Raw output length:', cleaned.length);
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (!arrayMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(arrayMatch[0]) as ArchitectureReviewItem[];
    } catch (error: any) {
        console.error('AI Architecture Multi Review Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Architecture Multi Review failed: ${error.message}`);
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
    try {
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

        const raw = await callOpenAI(prompt, apiKey, 12000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[NamePreambleReview] Raw AI output length:', cleaned.length);

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as NamePreambleReviewResult;

    } catch (error: any) {
        console.error('Name & Preamble Review Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Name & Preamble Review failed: ${error.message}`);
        throw error;
    }
}
