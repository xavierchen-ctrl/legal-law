import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

const cleanKey = (key: string | undefined) =>
    (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

export type DocumentType =
    | 'NDA' | 'COOPERATION' | 'AMENDMENT' | 'TERMINATION'
    | 'REPLY_LETTER' | 'COMPANY_LETTER' | 'FORMAL_LETTER' | 'REGISTERED_LETTER' | 'CLAUSE_DRAFT';

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

export interface DraftRequest {
    documentType: DocumentType;
    caseBackground: string;
    businessModel: string;
    companyPosition: string;
    riskPreference: RiskPreference;
    additionalNotes?: string;
    partyAName?: string;
    partyBName?: string;
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
    CLAUSE_DRAFT: '條文起草（多版本備選）',
};

const RISK_LABELS: Record<RiskPreference, string> = {
    CONSERVATIVE: '保守——強化甲方保護，加重乙方義務與限制',
    BALANCED: '平衡——公平分配權利義務，兼顧商業可行性',
    AGGRESSIVE: '積極商業導向——降低限制，最大化商業彈性',
};

const LETTER_TYPES = new Set<DocumentType>(['REPLY_LETTER', 'COMPANY_LETTER', 'FORMAL_LETTER', 'REGISTERED_LETTER']);

export async function draftDocument(req: DraftRequest, apiKey?: string): Promise<DraftResult> {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    const genAI = new GoogleGenerativeAI(effectiveKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const docLabel = DOC_TYPE_LABELS[req.documentType];
    const riskLabel = RISK_LABELS[req.riskPreference];
    const isLetter = LETTER_TYPES.has(req.documentType);
    const isClauseDraft = req.documentType === 'CLAUSE_DRAFT';
    const partyA = req.partyAName || '甲方（本公司）';
    const partyB = req.partyBName || '乙方（相對人）';

    const clauseFormat = isLetter
        ? '函文類文件：clauses 各段落 id 依序為 "opening"、"body_1"、"body_2"...、"closing"，title 為段落功能說明，不需條號。'
        : isClauseDraft
        ? '條文起草：clauses 為 3 至 5 個備選版本，各版本保護強度不同，title 說明版本特色（如「版本A：強保護」）。'
        : '契約條文：clauses 依序為各條，title 格式為「第N條 標題」。';

    const prompt = `你是資深法務律師，專精臺灣法律實務與契約起草。請依以下資訊以繁體中文起草${docLabel}。

資訊：
- 文件類型：${docLabel}
- 甲方：${partyA}
- 乙方：${partyB}
- 案件背景：${req.caseBackground}
- 商務模式：${req.businessModel}
- 公司立場：${req.companyPosition}
- 風險偏好：${riskLabel}
${req.additionalNotes ? `- 補充說明：${req.additionalNotes}` : ''}

輸出必須為純 JSON（不加 markdown code block），格式：
{
  "documentTitle": "文件完整標題",
  "parties": { "partyA": "${partyA}", "partyB": "${partyB}" },
  "preamble": "前言或鑑於條款",
  "clauses": [
    {
      "id": "1",
      "title": "第一條 ...",
      "content": "條文完整內容（可直接使用）",
      "draftNote": "起草說明（為何如此撰寫、風險考量）"
    }
  ],
  "closingTerms": "附則與簽署條款",
  "draftSummary": "整體起草說明（立場策略、主要考量）",
  "riskNotes": "風險提示（需人工確認或後續補充之事項）"
}

${clauseFormat}

法律語言要求：使用繁體中文、措辭正式精確、正確義務語氣（「應」/「得」/「不得」）、條文完整可直接使用。`;

    try {
        await logSystemEvent('contract-draft', 'INFO', `起草開始：${req.documentType}`);
        const response = await model.generateContent(prompt);
        const raw = response.response.text();
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
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    const genAI = new GoogleGenerativeAI(effectiveKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
        const response = await model.generateContent(prompt);
        const raw = response.response.text();
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as RewriteResult;
    } catch (err: any) {
        throw new Error(`條文改寫失敗：${err.message}`);
    }
}
