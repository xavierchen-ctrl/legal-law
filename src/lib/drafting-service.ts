import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type DocumentType =
    | 'NDA' | 'COOPERATION' | 'AMENDMENT' | 'TERMINATION'
    | 'REPLY_LETTER' | 'COMPANY_LETTER' | 'FORMAL_LETTER' | 'REGISTERED_LETTER'
    | 'COMPLAINT_LETTER' | 'CLAUSE_DRAFT';

export type RiskPreference = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface DraftClause {
    id: string;
    title: string;
    content: string;
    draftNote?: string;
}

export interface DraftResult {
    documentTitle: string;
    parties?: { partyA: string; partyB: string };
    preamble: string;
    clauses: DraftClause[];
    closingTerms: string;
    draftSummary: string;
    riskNotes: string;
}

export interface ReferenceDocument {
    name: string;
    text: string;
}

export interface DraftRequest {
    documentType: DocumentType;
    // 通用契約欄位
    caseBackground: string;
    businessModel: string;
    companyPosition: string;
    riskPreference: RiskPreference;
    additionalNotes?: string;
    partyAName?: string;
    partyBName?: string;
    // 函文／檢舉函類專用欄位（皆選填，依文件類型使用）
    recipient?: string;                  // 收件對象 / 受理機關
    sender?: string;                     // 寄件人 / 檢舉人
    factSummary?: string;                // 案件事實（具體：時間、人物、事件）
    claim?: string;                      // 主張 / 訴求 / 請求事項
    legalBasis?: string;                 // 法律依據（如：違反契約第X條、民法第Y條）
    deadlineAndConsequence?: string;     // 期限與後果
    incomingLetterRef?: string;          // 對方來函日期/字號（限法務回函）
    incomingLetterSummary?: string;      // 來函要旨（限法務回函）
    subjectOfComplaint?: string;         // 被檢舉對象（限檢舉函）
    allegedViolations?: string;          // 涉嫌違反法令（限檢舉函）
    // 參考資料（可上傳多份；AI 必須以實際內容為基礎）
    referenceDocuments?: ReferenceDocument[];
}

export interface RewriteRequest {
    clauseTitle: string;
    originalContent: string;
    rewriteGoal: string;
}

export interface RewriteResult {
    revised: string;
    changeExplanation: string;
    riskNote?: string;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
    NDA: '保密協議 (Non-Disclosure Agreement)',
    COOPERATION: '合作契約',
    AMENDMENT: '補充協議 / 修約',
    TERMINATION: '終止協議',
    REPLY_LETTER: '法務回函',
    COMPANY_LETTER: '公司函文',
    FORMAL_LETTER: '正式函文',
    REGISTERED_LETTER: '存證信函',
    COMPLAINT_LETTER: '檢舉函',
    CLAUSE_DRAFT: '條文起草（多版本備選）',
};

const RISK_LABELS: Record<RiskPreference, string> = {
    CONSERVATIVE: '保守——強化甲方保護，加重乙方義務與限制',
    BALANCED: '平衡——公平分配權利義務，兼顧商業可行性',
    AGGRESSIVE: '積極商業導向——降低限制，最大化商業彈性',
};

const LETTER_TYPES = new Set<DocumentType>(['REPLY_LETTER', 'COMPANY_LETTER', 'FORMAL_LETTER', 'REGISTERED_LETTER', 'COMPLAINT_LETTER']);
const COMPLAINT_TYPES = new Set<DocumentType>(['COMPLAINT_LETTER']);

function buildLetterFields(req: DraftRequest): string {
    const lines: string[] = [];
    if (req.recipient)             lines.push(`- 收件對象／受理機關：${req.recipient}`);
    if (req.sender)                lines.push(`- 寄件人／檢舉人：${req.sender}`);
    if (req.subjectOfComplaint)    lines.push(`- 被檢舉對象：${req.subjectOfComplaint}`);
    if (req.factSummary)           lines.push(`- 案件事實（具體）：${req.factSummary}`);
    if (req.allegedViolations)     lines.push(`- 涉嫌違反法令：${req.allegedViolations}`);
    if (req.claim)                 lines.push(`- 主張／訴求／請求事項：${req.claim}`);
    if (req.legalBasis)            lines.push(`- 法律依據：${req.legalBasis}`);
    if (req.deadlineAndConsequence) lines.push(`- 期限與後果：${req.deadlineAndConsequence}`);
    if (req.incomingLetterRef)     lines.push(`- 對方來函日期／字號：${req.incomingLetterRef}`);
    if (req.incomingLetterSummary) lines.push(`- 來函要旨：${req.incomingLetterSummary}`);
    return lines.length > 0 ? lines.join('\n') : '';
}

function buildReferenceSection(refs?: ReferenceDocument[]): string {
    if (!refs || refs.length === 0) {
        return `
═══ 參考資料 ═══
（使用者未上傳任何參考資料／附件）
⚠️ 重要：若使用者未提供具體事實依據，禁止杜撰任何具體情節、人名、日期、案號、標案類型、流程細節等。
凡使用者輸入欄位未提及之具體事實，必須以「[待補：xxx]」格式佔位，請使用者補充。`;
    }
    const docs = refs.slice(0, 5).map((r, i) =>
        `--- 附件 ${i + 1}：${r.name} ---\n"""\n${(r.text || '').substring(0, 6000)}\n"""`
    ).join('\n\n');
    return `
═══ 參考資料（使用者上傳之實際文件內容）═══
本次撰擬必須以下列實際文件內容為事實基礎，不得偏離：

${docs}

重要規則：
- 文件中明示之事實才可引用
- 文件未提及之具體事實（如背景、時間、人名、案號），不得自行推論或杜撰；以「[待補：xxx]」標示
- 若文件內容與使用者輸入欄位有衝突，以文件為準，並於 riskNotes 中說明`;
}

export async function draftDocument(req: DraftRequest, apiKey?: string): Promise<DraftResult> {
    const docLabel = DOC_TYPE_LABELS[req.documentType];
    const riskLabel = RISK_LABELS[req.riskPreference];
    const isLetter = LETTER_TYPES.has(req.documentType);
    const isComplaint = COMPLAINT_TYPES.has(req.documentType);
    const isClauseDraft = req.documentType === 'CLAUSE_DRAFT';
    const partyA = req.partyAName || '甲方（本公司）';
    const partyB = req.partyBName || '乙方（相對人）';

    const clauseFormat = isLetter
        ? '函文／檢舉函類文件：clauses 各段落 id 依序為 "opening"、"body_1"、"body_2"...、"closing"，title 為段落功能說明，不需條號。'
        : isClauseDraft
        ? '條文起草：clauses 為 3 至 5 個備選版本，各版本保護強度不同，title 說明版本特色（如「版本A：強保護」）。'
        : '契約條文：clauses 依序為各條，title 格式為「第N條 標題」。';

    const letterFieldsBlock = isLetter ? buildLetterFields(req) : '';
    const referenceBlock = buildReferenceSection(req.referenceDocuments);

    const antiFabricationRules = `
═══ 反虛構強制規則（CRITICAL — 違反將被視為錯誤輸出）═══
此次撰擬必須嚴格遵守以下原則，避免產出與案件事實不符之內容：

1. ⛔ 嚴禁加入「使用者未明示」之具體事實。包括但不限於：
   - 標案類型、案號（如「國防部XX標案」）
   - 投標／資格審查／決標流程細節
   - 對方公司名稱、特定人員、特定日期
   - 法律案例或判決字號（除非使用者已提供）
   - 條約／法規條號（除非使用者已提供，或為通用普遍知悉者）

2. ✅ 缺漏之處請以「[待補：xxx]」明確佔位。例如：
   - 「於 [待補：發生日期] 時，被檢舉人[待補：具體姓名／職稱] 之行為...」
   - 「請依 [待補：對應法令條號] 之規定處置」
   絕不要編造具體細節以「讓文件看起來完整」。

3. ✅ 用語應抽象、結構正確、保留待補空間。
   寧可結構性留白，也不要 hallucination 出與案件無關之事實。

4. ✅ 若使用者輸入過於簡略，於 riskNotes 中明確列出：
   - 「使用者未提供之關鍵事實清單」
   - 「建議補充之資料項目」
   - 「目前以 [待補] 標示之處」

5. ${isComplaint ? '🚨 檢舉函特別注意：檢舉函直接影響當事人權益，內容須客觀、有依據，禁止以推論代替事實。所有事實主張須能對應使用者提供之具體陳述或上傳之附件內容。' : ''}
`;

    const prompt = `你是資深法務律師，專精臺灣法律實務與契約／函文起草。請依以下資訊以繁體中文起草${docLabel}。
${antiFabricationRules}
═══ 資訊 ═══
- 文件類型：${docLabel}
- 甲方：${partyA}
- 乙方：${partyB}
- 案件背景：${req.caseBackground || '（未提供）'}
- 商務模式：${req.businessModel || '（未提供 — 若為函文類可忽略）'}
- 公司立場：${req.companyPosition || '（未提供）'}
- 風險偏好：${riskLabel}
${req.additionalNotes ? `- 補充說明：${req.additionalNotes}` : ''}
${letterFieldsBlock ? `\n═══ 函文／檢舉函結構欄位 ═══\n${letterFieldsBlock}` : ''}
${referenceBlock}

═══ 輸出格式 ═══
僅回傳純 JSON（不加 markdown code block）：
{
  "documentTitle": "文件完整標題",
  "parties": { "partyA": "${partyA}", "partyB": "${partyB}" },
  "preamble": "前言或鑑於條款／函文之開頭稱謂段",
  "clauses": [
    {
      "id": "1",
      "title": "第一條 ... 或 段落功能說明",
      "content": "條文／段落完整內容（缺漏之處以 [待補：xxx] 標示）",
      "draftNote": "起草說明（為何如此撰寫、風險考量、待補資訊提示）"
    }
  ],
  "closingTerms": "附則與簽署條款／函文結尾",
  "draftSummary": "整體起草說明（立場策略、主要考量、本次以哪些事實為基礎）",
  "riskNotes": "風險提示（需人工確認或後續補充之事項；若有 [待補] 處請逐項列出建議補充內容）"
}

${clauseFormat}

法律語言要求：使用繁體中文、措辭正式精確、正確義務語氣（「應」/「得」/「不得」）。
絕對紀律：不得自行推論未提供之具體事實。`;

    try {
        await logSystemEvent('contract-draft', 'INFO', `起草開始：${req.documentType}`);
        const raw = await callOpenAI(prompt, apiKey, 16000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤，請重試');
        const result: DraftResult = JSON.parse(jsonMatch[0]);
        await logSystemEvent('contract-draft', 'SUCCESS', `起草完成：${req.documentType}，共 ${result.clauses.length} 條`);
        return result;
    } catch (err: any) {
        await logSystemEvent('contract-draft', 'ERROR', `起草失敗：${err.message}`);
        throw new Error(`文件起草失敗：${err.message}`);
    }
}

export async function rewriteClause(req: RewriteRequest, apiKey?: string): Promise<RewriteResult> {
    const prompt = `你是資深法務律師，請依指示改寫以下合約條文，以繁體中文回應。

條文標題：${req.clauseTitle}
原始內容：
${req.originalContent}

改寫方向：${req.rewriteGoal}

輸出必須為純 JSON（不加 markdown），格式：
{
  "revised": "改寫後完整條文內容",
  "changeExplanation": "主要修改內容及理由",
  "riskNote": "風險或注意事項（無則留空字串）"
}`;

    try {
        const raw = await callOpenAI(prompt, apiKey, 4000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as RewriteResult;
    } catch (err: any) {
        throw new Error(`條文改寫失敗：${err.message}`);
    }
}
