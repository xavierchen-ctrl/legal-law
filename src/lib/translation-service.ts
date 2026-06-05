import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export interface LegalTerm {
    term: string;
    translation: string;
    note: string;
}

export interface AmbiguityFlag {
    originalText: string;
    issue: string;
    alternatives: string[];
}

export interface TranslationClause {
    id: number;
    clauseTitle: string;
    originalText: string;
    translatedText: string;
    legalTerms: LegalTerm[];
    ambiguities: AmbiguityFlag[];
}

export interface TranslationResult {
    contractSummary: string;
    clauses: TranslationClause[];
    glossary: LegalTerm[];
}

export interface ChToEnTranslationClause {
    id: number;
    clauseTitle: string;
    originalText: string;
    translatedText: string;
    legalTerms: LegalTerm[];
    ambiguities: AmbiguityFlag[];
    scopeWarnings: string[];
}

export interface ChToEnTranslationResult {
    contractSummary: string;
    clauses: ChToEnTranslationClause[];
    glossary: LegalTerm[];
}

const LEGAL_TERM_EXAMPLES = `
Common legal terms and their preferred Traditional Chinese translations:
- "shall" → 「應」（強制義務）
- "may" → 「得」（授權性條款）
- "indemnify" → 「賠償並使免受損害」
- "indemnification" → 「損害補償」
- "warrant / warranty" → 「擔保」
- "represent / representation" → 「陳述」
- "covenant" → 「承諾」/ 「約定」
- "notwithstanding" → 「儘管」/ 「不論」
- "material breach" → 「重大違約」
- "force majeure" → 「不可抗力」
- "governing law" → 「準據法」
- "jurisdiction" → 「管轄」
- "arbitration" → 「仲裁」
- "liquidated damages" → 「違約金」
- "consequential damages" → 「間接損害」
- "limitation of liability" → 「責任限制」
- "intellectual property" → 「智慧財產權」
- "confidential information" → 「機密資訊」
- "termination for cause" → 「有因終止」
- "termination for convenience" → 「任意終止」
- "assignment" → 「讓與」
- "sublicense" → 「再授權」
- "in perpetuity" → 「永久」
- "irrevocable" → 「不可撤銷」
- "exclusive" → 「專屬」/ 「獨家」
- "non-exclusive" → 「非專屬」
- "good faith" → 「善意」/ 「誠信」
- "reasonable" → 「合理」
- "forthwith" → 「立即」/ 「隨即」
- "hereinafter" → 「以下簡稱」
- "whereas" → 「鑒於」
- "in witness whereof" → 「茲為證明」
`;

export async function translateContractText(
    text: string,
    apiKey?: string
): Promise<TranslationResult> {
    try {
        const prompt = `
You are a senior legal translator specializing in Traditional Chinese (繁體中文) legal documents for Taiwanese companies.

Your task is to translate the following English contract text into Traditional Chinese, following these 5 strict requirements:
1. Preserve all legal effects — the translated text must be legally equivalent to the original
2. Use proper Traditional Chinese legal terminology (see reference list below)
3. Avoid literal word-for-word translation that causes semantic drift — prioritize meaning over form
4. Ensure clause logic and structure is consistent with the original
5. Flag ANY passage that may carry multiple interpretations or where the translation requires a judgment call

Legal Term Reference:
${LEGAL_TERM_EXAMPLES}

Input Contract Text:
"""
${text.substring(0, 28000)}
"""

Output Format:
Return ONLY a raw JSON object (no markdown code blocks). Structure:
{
    "contractSummary": "2-3 sentence summary of this contract in Traditional Chinese",
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "Clause title in Chinese (e.g. '第一條 定義')",
            "originalText": "The original English text of this clause",
            "translatedText": "The Traditional Chinese translation",
            "legalTerms": [
                {
                    "term": "English term used in this clause",
                    "translation": "Chinese translation chosen",
                    "note": "Why this translation was chosen"
                }
            ],
            "ambiguities": [
                {
                    "originalText": "The specific English phrase that is ambiguous",
                    "issue": "Explain why this is ambiguous or has multiple interpretations",
                    "alternatives": ["Interpretation A", "Interpretation B"]
                }
            ]
        }
    ],
    "glossary": [
        {
            "term": "English term",
            "translation": "Chinese translation",
            "note": "Usage note"
        }
    ]
}

If the contract text is not divided into clear clauses, divide it logically yourself.
The "ambiguities" array should be empty [] if the clause is unambiguous.
The "legalTerms" array should list only notable legal terms, not every word.
`;

        const raw = await callOpenAI(prompt, apiKey, 32000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[TranslationService] Raw AI output length:', cleaned.length);

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as TranslationResult;

    } catch (error: any) {
        console.error('[TranslationService] Failed:', error);
        await logSystemEvent('TranslationService', 'ERROR', `Translation failed: ${error.message}`);
        throw error;
    }
}

const EN_LEGAL_TERM_REFERENCE = `
Preferred English legal terms for international commercial contracts:
- 應 / 須 → "shall" (mandatory obligation)
- 得 / 可 → "may" (permissive)
- 及 / 和 → "and" — use "and/or" only when disjunctive is genuinely intended
- 包含但不限於 → "including but not limited to"
- 賠償並使免受損害 → "indemnify and hold harmless"
- 擔保 → "warrant" / "warranty"
- 陳述 → "represent" / "representation"
- 承諾 / 約定 → "covenant" / "undertake"
- 儘管 / 不論 → "notwithstanding"
- 重大違約 → "material breach"
- 不可抗力 → "force majeure"
- 準據法 → "governing law"
- 管轄 → "jurisdiction"
- 仲裁 → "arbitration"
- 違約金 → "liquidated damages"
- 間接損害 → "consequential damages" / "indirect damages"
- 責任限制 → "limitation of liability"
- 智慧財產權 → "intellectual property rights"
- 機密資訊 → "Confidential Information"
- 有因終止 → "termination for cause"
- 任意終止 → "termination for convenience"
- 讓與 → "assign" / "assignment"
- 再授權 → "sublicense"
- 永久 → "in perpetuity"
- 不可撤銷 → "irrevocable"
- 專屬 / 獨家 → "exclusive"
- 非專屬 → "non-exclusive"
- 善意 / 誠信 → "good faith"
- 合理 → "reasonable" / "reasonably"
- 立即 / 隨即 → "promptly" / "immediately"
- 以下簡稱 → "hereinafter referred to as"
- 鑒於 → "whereas"
- 茲為證明 → "in witness whereof"
- 雙方同意 → "the Parties agree"
- 依本合約 → "under this Agreement" / "pursuant to this Agreement"
- 書面通知 → "written notice"
- 相對人 / 乙方 → define as named Party (e.g., "Counterparty" or specific entity name)
`;

export async function translateChineseToEnglish(
    text: string,
    apiKey?: string
): Promise<ChToEnTranslationResult> {
    try {
        const prompt = `
You are a senior legal translator specializing in translating Traditional Chinese (繁體中文) contract clauses into English for international commercial use.

Your task is to translate the following Chinese contract text into English, strictly following these 5 requirements:
1. Use standard international commercial contract terminology (e.g., "shall", "may", "including but not limited to", "indemnify and hold harmless", "notwithstanding", etc.) — do NOT use plain conversational English.
2. Preserve all legal effects — the translated text must be legally equivalent to the original; do not add or remove obligations, rights, or limitations.
3. Do NOT translate word-for-word from Chinese structure — restructure sentences naturally in English legal drafting style (subject-verb-object, active voice preferred for obligations).
4. Flag any clause where the scope of liability, obligation, or right may have been inadvertently expanded or narrowed due to structural differences between Chinese and English.
5. Ensure consistency of defined terms throughout (e.g., if 甲方 is "Party A" and 乙方 is "Party B", use these consistently).

Legal Term Reference:
${EN_LEGAL_TERM_REFERENCE}

Input Contract Text (Traditional Chinese):
"""
${text.substring(0, 28000)}
"""

Output Format:
Return ONLY a raw JSON object (no markdown code blocks). Structure:
{
    "contractSummary": "2-3 sentence summary of this contract in English",
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "Clause title in English (e.g. 'Article 1 — Definitions')",
            "originalText": "The original Chinese text of this clause",
            "translatedText": "The English translation using international commercial contract language",
            "legalTerms": [
                {
                    "term": "Chinese term used in this clause",
                    "translation": "English legal term chosen",
                    "note": "Why this translation was chosen and any nuance"
                }
            ],
            "ambiguities": [
                {
                    "originalText": "The specific Chinese phrase that is ambiguous or structurally challenging",
                    "issue": "Explain the translation challenge or multiple possible interpretations",
                    "alternatives": ["English rendering A", "English rendering B"]
                }
            ],
            "scopeWarnings": [
                "Description of any scope expansion or reduction introduced by the translation"
            ]
        }
    ],
    "glossary": [
        {
            "term": "Chinese term",
            "translation": "English legal term",
            "note": "Usage note and rationale"
        }
    ]
}

If the contract text is not divided into clear clauses, divide it logically.
The "ambiguities" array should be [] if the clause is unambiguous.
The "scopeWarnings" array should be [] if no scope shift was detected.
The "legalTerms" array should list only notable legal terms requiring a translation judgment call.
`;

        const raw = await callOpenAI(prompt, apiKey, 32000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[TranslationService ZH→EN] Raw AI output length:', cleaned.length);

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as ChToEnTranslationResult;

    } catch (error: any) {
        console.error('[TranslationService ZH→EN] Failed:', error);
        await logSystemEvent('TranslationService', 'ERROR', `ZH→EN Translation failed: ${error.message}`);
        throw error;
    }
}

export type GenericLangPair =
    | 'zh-ja'   // 中翻日
    | 'ja-zh'   // 日翻中
    | 'zh-zhs'  // 中翻簡體
    | 'zhs-zh'  // 簡體翻中
    | 'zh-vi'   // 中翻越南
    | 'vi-zh';  // 越南翻中

export interface GenericTranslationResult {
    summary: string;
    translatedText: string;
}

const LANG_META: Record<GenericLangPair, { from: string; to: string; instruction: string }> = {
    'zh-ja':  { from: '繁體中文', to: '日文',   instruction: '請將以下繁體中文合約條款翻譯為日文（正式法律用語）。保留所有法律效力，使用書面日語敬體（です・ます體），法律術語使用慣用漢字。' },
    'ja-zh':  { from: '日文',    to: '繁體中文', instruction: '請將以下日文合約條款翻譯為繁體中文（正式法律用語）。保留所有法律效力，使用台灣慣用法律用詞。' },
    'zh-zhs': { from: '繁體中文', to: '簡體中文', instruction: '請將以下繁體中文合約條款轉換為簡體中文。保留所有法律用語與格式，僅作文字轉換，不更動任何語意或條款結構。' },
    'zhs-zh': { from: '簡體中文', to: '繁體中文', instruction: '請將以下簡體中文合約條款轉換為繁體中文（台灣用法）。保留所有法律用語與格式，僅作文字轉換，不更動任何語意或條款結構。' },
    'zh-vi':  { from: '繁體中文', to: '越南文',  instruction: '請將以下繁體中文合約條款翻譯為越南文（正式法律用語）。保留所有法律效力，使用越南商業合約慣用措辭。' },
    'vi-zh':  { from: '越南文',  to: '繁體中文', instruction: '請將以下越南文合約條款翻譯為繁體中文（正式法律用語）。保留所有法律效力，使用台灣慣用法律用詞。' },
};

export async function translateGeneric(
    text: string,
    langPair: GenericLangPair,
    apiKey?: string
): Promise<GenericTranslationResult> {
    const meta = LANG_META[langPair];

    try {
        const prompt = `你是一位資深法律翻譯專家。

${meta.instruction}

輸入合約原文（${meta.from}）：
"""
${text.substring(0, 28000)}
"""

請以純 JSON 格式回傳（不含 markdown code block）：
{
  "summary": "本合約內容摘要（2-3句，以${meta.to}撰寫）",
  "translatedText": "完整翻譯後的合約條款（${meta.to}）"
}`;

        const raw = await callOpenAI(prompt, apiKey, 32000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as GenericTranslationResult;

    } catch (error: any) {
        console.error(`[TranslationService ${langPair}] Failed:`, error);
        await logSystemEvent('TranslationService', 'ERROR', `${langPair} translation failed: ${error.message}`);
        throw error;
    }
}
