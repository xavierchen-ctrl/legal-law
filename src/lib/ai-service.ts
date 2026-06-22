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

export interface ArchitectureCaseContext {
    contractTypeHint?: string;   // e.g. "勞動契約"、"商務服務"、"NDA"；空字串或 "AUTO" 由 AI 自動判斷
    businessBackground?: string; // 案件背景、交易目的
    legalFocus?: string;         // 法務關注重點（如：身心障礙者定額進用、外籍人士、競業禁止）
}

export interface ArchitectureReviewResult {
    contractType: string;            // AI 識別出的契約類型，例如 "勞動／聘僱契約"
    contractTypeReasoning: string;   // 為何判斷為此類型
    frameworkNote: string;           // 本次採用之評估框架說明
    items: ArchitectureReviewItem[];
}

const CONTRACT_TYPE_FRAMEWORK = `
═══ 契約類型與評估框架對照表 ═══
請依識別出的契約類型，調整 5 項評估標準之具體內涵，避免將商務契約邏輯套用於非商務契約：

【勞動/聘僱契約】（受僱、聘僱、雇主、薪資、工時、勞健保…）
- 基本交易條款 → 聘僱期間、職務內容、工作地點、工時、薪資結構、勞健保、退休金提繳
- 風險分配條款 → 競業禁止（須符合勞基法 §9-1）、保密義務、離職交接、職業災害補償
- 一般條款 → 終止解僱（須符合勞基法 §11、§12、§14）、勞資爭議調解、準據法
- 重要條款缺漏 → 勞基法強制條款（工時、休假、加班費）、特殊勞工保護（如身心障礙者親自履行勞務、定額進用認列規範）
- ⚠️ 不應強求：責任上限、間接損害排除、商務型賠償上限（此類條款多受勞動法令強制規範，並非勞動契約必要要素）

【委任契約】（委任、處理事務、報酬）
- 基本交易條款 → 委任事務範圍、報酬、費用、期間
- 風險分配條款 → 忠實義務、注意義務、保密、競業限制
- 重要條款缺漏 → 任意終止權（民法 §549）、報告義務、利益歸還

【承攬契約】（承攬、完成工作、報酬）
- 基本交易條款 → 工作內容、報酬、完工期限、瑕疵擔保期間
- 風險分配條款 → 瑕疵擔保、危險負擔、損害賠償
- 重要條款缺漏 → 驗收條款、變更工作條款、權利義務移轉

【買賣契約】（出賣、買受、價金）
- 基本交易條款 → 標的物、價金、交付時間地點、所有權移轉
- 風險分配條款 → 瑕疵擔保（民法 §354 以下）、風險移轉時點、品質保證
- 重要條款缺漏 → 檢驗條款、權利瑕疵擔保、不可抗力

【租賃契約】（出租、承租、租金）
- 基本交易條款 → 標的物、租金、租期、押租金
- 風險分配條款 → 修繕義務、保險、瑕疵擔保
- 重要條款缺漏 → 提前終止、轉租限制、租賃物返還

【保密契約 NDA】（保密、機密資訊）
- 基本交易條款 → 機密資訊定義、保密期間、用途限制
- 風險分配條款 → 例外情形、違約金、損害賠償
- 重要條款缺漏 → 返還銷毀、員工延伸義務、救濟條款

【授權契約】（授權、智慧財產權）
- 基本交易條款 → 授權標的、授權範圍、權利金、地域、期間
- 風險分配條款 → 權利擔保、侵權通知與防禦、再授權限制
- 重要條款缺漏 → 改作衍生、終止後處理、品質控制

【商務合作 / 服務委外契約】（一般商務）
- 基本交易條款 → 服務內容、付款條件、SLA、驗收
- 風險分配條款 → 責任上限、間接損害排除、賠償上限、保密、保險
- 重要條款缺漏 → 責任限制、終止條款、不可抗力、轉讓限制
- ✅ 此類契約適用商務型責任限制條款分析
`;

function buildCaseContextSection(ctx?: ArchitectureCaseContext): string {
    if (!ctx) return '';
    const parts: string[] = [];
    if (ctx.contractTypeHint && ctx.contractTypeHint !== 'AUTO') {
        parts.push(`- 使用者指定契約類型：${ctx.contractTypeHint}（請以此為主，但仍須驗證實質內容是否相符）`);
    }
    if (ctx.businessBackground) {
        parts.push(`- 案件背景／交易目的：${ctx.businessBackground}`);
    }
    if (ctx.legalFocus) {
        parts.push(`- 法務關注重點：${ctx.legalFocus}（請將此議題納入分析重點，於相關項目中優先檢視）`);
    }
    if (parts.length === 0) return '';
    return `
═══ 案件背景與法務關注事項（使用者提供） ═══
${parts.join('\n')}
請將上述背景納入分析；若法務已明確點出特定關注議題（例如：身心障礙者定額進用、外籍人士、競業禁止…），應於相關項目之 detail 中具體回應該議題。
`;
}

function buildArchPrompt(opts: {
    docsSection: string;
    isMulti: boolean;
    docCount: number;
    docList?: string;
    caseContext?: ArchitectureCaseContext;
}): string {
    const { docsSection, isMulti, docCount, docList, caseContext } = opts;
    const itemCount = isMulti ? 6 : 5;
    const extraItem = isMulti
        ? '\n6. 文件間矛盾與衝突（主約與附件間的定義衝突、義務矛盾、付款條件不一致等）'
        : '';

    return `你是資深台灣法律顧問，專精合約架構審查。

═══ STEP 1：契約類型識別 ═══
請先就所提供文件之標題、前言與核心義務，識別本契約之類型（如：勞動／聘僱、委任、承攬、買賣、租賃、保密、授權、商務合作、服務委外…）。
若無法明確分類，請以「最接近的主要類型」標示，並於 reasoning 中說明判斷依據（具體引述條文用語）。

${CONTRACT_TYPE_FRAMEWORK}

═══ STEP 2：採用對應評估框架 ═══
依識別出的契約類型，套用上述「契約類型與評估框架對照表」對應之內涵。
特別注意：勞動契約不應強求商務型「責任上限／間接損害排除」等條款，請避免誤判。
${buildCaseContextSection(caseContext)}
═══ STEP 3：分析下列文件 ═══
${isMulti ? `（共 ${docCount} 份文件）\n文件清單：\n${docList}\n` : ''}
${docsSection}

═══ STEP 4：產出 ${itemCount} 項評估 ═══
1. 基本交易條款完整性
2. 風險分配條款
3. 一般條款
4. 條款前後一致性${isMulti ? '（含文件間交叉一致性）' : ''}
5. 重要條款缺漏${extraItem}

每一項皆須：
- 對照「該契約類型」之應有內涵（不要套用其他契約類型之檢核邏輯）
- 若使用者已提供法務關注重點，於相關項目中具體回應
- 指出具體缺漏條款名稱、對應風險、可補充方向（避免空泛說「條款不足」）

═══ 輸出格式 ═══
僅回傳純 JSON 物件（不加 markdown code block）：
{
  "contractType": "識別出的契約類型，例如：勞動／聘僱契約",
  "contractTypeReasoning": "判斷依據（繁體中文，1-2 句，引述關鍵用語）",
  "frameworkNote": "本次採用之評估框架重點說明（繁體中文，1-2 句，例如：『以勞動契約框架分析，著重勞基法強制條款；責任上限／間接損害排除非必要項目』）",
  "items": [
    {
      "id": 1,
      "category": "評估項目短標題",
      "title": "評估項目完整描述（依契約類型調整）",
      "status": "PASS" | "WARN" | "FAIL",
      "detail": "詳細說明（繁體中文）：具體指出缺漏條款內容、對應風險、建議補充方向。若 PASS 也請說明已具備哪些對應條款。"
    }
  ]
}
items 陣列須有 ${itemCount} 項。
`;
}

function parseArchResult(raw: string, itemCount: number): ArchitectureReviewResult {
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

    // 兼容舊格式（AI 偶爾回傳陣列）
    if (Array.isArray(parsed)) {
        return {
            contractType: '未指定',
            contractTypeReasoning: 'AI 未提供類型判斷（使用通用框架）',
            frameworkNote: '採用通用合約檢核框架',
            items: parsed as ArchitectureReviewItem[],
        };
    }

    return {
        contractType: parsed.contractType ?? '未指定',
        contractTypeReasoning: parsed.contractTypeReasoning ?? '',
        frameworkNote: parsed.frameworkNote ?? '',
        items: Array.isArray(parsed.items) ? parsed.items : [],
    };
}

export async function analyzeContractArchitecture(
    text: string,
    caseContext?: ArchitectureCaseContext,
    apiKey?: string
): Promise<ArchitectureReviewResult> {
    try {
        const prompt = buildArchPrompt({
            docsSection: `"""\n${text.substring(0, 30000)}\n"""`,
            isMulti: false,
            docCount: 1,
            caseContext,
        });

        const raw = await callOpenAI(prompt, apiKey, 8000, true);
        console.log('🤖 AI Architecture Review Raw output length:', raw.length);
        return parseArchResult(raw, 5);

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
    caseContext?: ArchitectureCaseContext,
    apiKey?: string
): Promise<ArchitectureReviewResult> {
    const isMulti = docs.length > 1;
    const charPerDoc = Math.min(8000, Math.floor(40000 / docs.length));

    const docsSection = docs.map((d, i) =>
        `--- 文件 ${i + 1}：${d.label}${d.version ? `（${d.version}）` : ''} ---\n"""\n${d.text.substring(0, charPerDoc)}\n"""`
    ).join('\n\n');

    const docList = docs.map((d, i) => `${i + 1}. ${d.label}${d.version ? `（${d.version}）` : ''}`).join('\n');

    const prompt = buildArchPrompt({
        docsSection,
        isMulti,
        docCount: docs.length,
        docList,
        caseContext,
    });

    try {
        const raw = await callOpenAI(prompt, apiKey, 10000, true);
        console.log('[ArchReviewMulti] Raw output length:', raw.length);
        return parseArchResult(raw, isMulti ? 6 : 5);
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

═══ STEP 3 (MANDATORY): READ THE ENTIRE CONTRACT BEFORE ANALYZING NAME/PREAMBLE ═══
BEFORE making any finding about the name or preamble, you MUST scan ALL clauses of the contract to understand:
(a) The actual business model — is this 合作（joint endeavor）、委任（mandate）、承攬（contract for work）、買賣（sale）、勞動／聘僱（employment）、代理（agency）、經銷（distribution）、授權（license）, etc.?
   Look at: who does what, who bears risk, who gets paid for what, division of revenue/cost, control relationship.
(b) Each party's substantive role across ALL clauses (not only the preamble).
(c) The contract's overall framework and clause structure.

Only after this overall reading may you assess whether the name/preamble matches reality.

═══ STEP 4 (CRITICAL): TWO ANTI-OVER-CLASSIFICATION RULES ═══

RULE A — Cross-check before flagging a "role omission" in the preamble:
Before claiming the preamble fails to describe a party's role, search ALL clauses of the contract for that role.
If the role IS described in the body (e.g. 工作內容、合作項目、職責、服務範圍、開發推廣等條款), then:
  - DO NOT flag this as a defect of the preamble.
  - At most, mention it as a minor OPTIMIZATION suggestion, and only if it would genuinely improve readability.
  - In the detail, explicitly state where the role IS described (cite the clause).

RULE B — Substance-first terminology analysis (do NOT mechanically replace terms):
Before suggesting that a term like 「合作」 should be replaced by 「委託」、「委任」、「代理」、「承攬」 etc., verify the substantive content:
  - If the body describes a joint promotion / joint sales / shared revenue / mutual contribution arrangement → 「合作」IS the correct term. DO NOT suggest changing it.
  - Only suggest 「委託／委任」 if the body actually shows one party paying another to handle affairs on its behalf.
  - Only suggest 「代理」 if there is actual agency authority granted to act in another's name.
  - Only suggest 「勞動／僱傭」 (over 「顧問」 or 「承攬」) if substantive labor-law triggers are present (人格從屬、組織從屬、經濟從屬).
The goal: do NOT lead users into mis-characterizing the legal relationship by suggesting "more precise" terms that are actually wrong for the underlying business model.

═══ STEP 5: REVIEW CRITERIA ═══
Analyze the contract name and preamble on exactly 5 criteria:
1. 契約名稱是否與實際交易內容一致（名稱反映的法律關係是否符合條款實質）
2. 前言是否正確描述合作目的與交易架構（背景、目的、當事人角色）— remember RULE A
3. 契約名稱與條款內容是否一致（避免名稱標榜甲方不承擔責任但條款卻相反）
4. 是否使用不精確或誤導性用語 — remember RULE B
5. 名稱或前言是否可能影響後續法律解釋或責任認定（如勞動/承攬爭議、稅務定性）

═══ STEP 6: FINDING TYPE CLASSIFICATION — STRICT ═══
For each non-PASS item, assign a findingType. BE STRICT, NOT GENEROUS:

- MAJOR_RISK (重大法律風險): Reserve for issues that would actually affect contract validity/enforceability, create serious unintended liability, cause legal-status misclassification (e.g. employment vs. service-contract), or expose a party to regulatory/tax consequences. SHOULD BE RARE.

- GENERAL_RISK (一般風險提醒): Concrete moderate risk — meaningful ambiguity in a legally significant term, real likelihood of dispute. NOT for "could be clearer" issues.

- OPTIMIZATION (條文優化): Wording could be clearer, more complete, or more conventional, but poses NO concrete legal risk. Examples that BELONG here (NOT in MAJOR/GENERAL_RISK):
  * 勞動契約中「應配合甲方合理之出勤、考核及管理措施」等可由工作規則／管理辦法／雇主管理權補足之事項
  * 用語精確性的改善建議（已可從上下文推知意思時）
  * 對任意條款的補充建議
  * 商務用語的細緻化（但實質含義已明確時）

- DRAFTING (起草建議): Stylistic preference or conventional phrasing only — not a risk.

DO-NOT-DO LIST (will be checked):
✗ DO NOT flag matters that can be governed by 工作規則／管理辦法／雇主管理權 (in labor contracts) as MAJOR_RISK or GENERAL_RISK. At most OPTIMIZATION.
✗ DO NOT flag a preamble for "missing role description" if the body's clauses describe that role.
✗ DO NOT suggest 「合作」→「委託」 unless the body clearly describes a mandate/agency relationship.
✗ DO NOT over-classify "could be more precise" as MAJOR_RISK or GENERAL_RISK. Wording-precision feedback is OPTIMIZATION.

For PASS items, set findingType: "PASS".

═══ OUTPUT FORMAT ═══
Return ONLY a raw JSON object (no markdown):
{
    "trackChangesDetected": false,
    "trackChangesWarning": null,
    "overallAssessment": "2-3 sentence overall assessment in Traditional Chinese. If the analysis finds only OPTIMIZATION/DRAFTING items (no MAJOR_RISK / GENERAL_RISK / FAIL), explicitly state '無重大法律風險或必要修約事項，以下為文字優化建議'.",
    "suggestedName": "Suggested corrected name, or null if the current name is appropriate",
    "suggestedPreamble": "Suggested corrected preamble, or null if the current preamble is appropriate",
    "items": [
        {
            "id": 1,
            "category": "Short category label",
            "title": "Full criterion description",
            "status": "PASS",
            "findingType": "PASS",
            "detail": "Detailed findings in Traditional Chinese — quote problematic text if any. If RULE A applies (role IS described in the body), state which clause already describes it. If RULE B applies (term is appropriate to the substantive content), say so.",
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
