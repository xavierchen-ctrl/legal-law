import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// ─── 文字正規化：移除非條文性差異（檔名、版本、頁碼、空白）─────────────────────
function normalizeForDiff(text: string): string {
    return text
        // 零寬字元、BOM
        .replace(/[​-‍﻿]/g, '')
        // 檔名／版本標示（V1、V2.1、Version 3、版本：1.0、ver 2 等）
        .replace(/(?:^|[\s（(])V\s*\d+(?:\.\d+)*(?=[\s）)、,，.。:：\-_\/\\]|$)/gi, ' ')
        .replace(/(?:版本|Version|Ver\.?)\s*[:：]?\s*\d+(?:\.\d+)*/gi, ' ')
        // 頁碼（第 X 頁 / 共 Y 頁、Page X of Y、- 1 -）
        .replace(/第\s*\d+\s*[頁页](?:\s*[,，/／、]\s*共\s*\d+\s*[頁页])?/g, ' ')
        .replace(/Page\s*\d+\s*(?:of\s*\d+)?/gi, ' ')
        .replace(/[-—]\s*\d+\s*[-—]/g, ' ')
        // 檔案副檔名痕跡
        .replace(/\.(pdf|docx?|txt)\b/gi, ' ')
        // 統一全形空白／多重空白
        .replace(/[\s　]+/g, ' ')
        .trim();
}

// ─── 內容雜湊：去除所有空白／引號變體後做字元比對 ────────────────────────────
function contentFingerprint(text: string): string {
    return normalizeForDiff(text)
        .replace(/\s+/g, '')                  // 全部空白
        .replace(/[「」『』""'']/g, '"')       // 中文引號→ASCII
        .replace(/[，,、]/g, ',')              // 各式逗號
        .replace(/[。.]/g, '.')                // 句號
        .toLowerCase();
}

function buildNoChangeResult(reason: string): ContractDiffResult {
    return {
        summary: reason,
        overallRiskLevel: 'NONE',
        totalChanges: 0,
        addedClauses: 0,
        removedClauses: 0,
        modifiedClauses: 0,
        majorRisks: [],
        recommendations: [],
        clauses: [],
    };
}

export interface ClauseDiff {
    id: number;
    clauseTitle: string;
    changeType: ChangeType;
    oldText: string | null;
    newText: string | null;
    impactLevel: ImpactLevel;
    impactDescription: string;
    affectedRights: string[];
    reviewComment: string | null;
}

export interface ContractDiffResult {
    summary: string;
    overallRiskLevel: RiskLevel;
    totalChanges: number;
    addedClauses: number;
    removedClauses: number;
    modifiedClauses: number;
    majorRisks: string[];
    recommendations: string[];
    clauses: ClauseDiff[];
}

export async function compareContractVersions(
    versionA: string,
    versionB: string,
    reviewComments: string,
    apiKey?: string
): Promise<ContractDiffResult> {
    try {
        // ── Short-circuit 1：內容雜湊比對 ──
        // 移除所有空白／檔名／頁碼／引號變體後做字元比對；若完全相同，直接回傳無變更結果（不呼叫 AI）。
        const fpA = contentFingerprint(versionA);
        const fpB = contentFingerprint(versionB);
        if (fpA === fpB && fpA.length > 0) {
            console.log('[DiffService] Short-circuit: content fingerprints identical, no AI call needed.');
            await logSystemEvent('DiffService', 'INFO', 'Content fingerprints identical — short-circuit no-change result.');
            return buildNoChangeResult(
                '兩版本去除檔名、版本標示、頁碼及空白後條文內容完全相同，無任何條文實質變更。' +
                '（系統先以內容雜湊比對，未呼叫 AI，避免格式雜訊影響判讀。）'
            );
        }

        // ── Short-circuit 2：高相似度（>99%）通常為純格式差異 ──
        const minLen = Math.min(fpA.length, fpB.length);
        const maxLen = Math.max(fpA.length, fpB.length);
        const lenRatio = maxLen > 0 ? minLen / maxLen : 1;
        if (lenRatio > 0.995) {
            // 長度幾乎一樣，再做字元差異粗估
            let diff = 0;
            for (let i = 0; i < minLen; i++) if (fpA[i] !== fpB[i]) diff++;
            const diffRatio = maxLen > 0 ? diff / maxLen : 0;
            if (diffRatio < 0.005) {
                console.log(`[DiffService] Short-circuit: ${(diffRatio * 100).toFixed(3)}% char diff, treating as no-change.`);
                return buildNoChangeResult(
                    '兩版本條文內容差異低於 0.5%（多為標點、空白或排版細節），無實質條文變更。' +
                    '若您認為應有實質差異，請改用「貼上文字」模式重新比對。'
                );
            }
        }

        // ── 正規化後再送給 AI，減少格式雜訊 ──
        const normalizedA = normalizeForDiff(versionA);
        const normalizedB = normalizeForDiff(versionB);

        const reviewSection = reviewComments.trim().length > 0
            ? `\n\nHistorical Review Comments (過往審約意見):\n"""\n${reviewComments.substring(0, 3000)}\n"""\nFor each changed clause, note whether the review comments were addressed.`
            : '';

        const prompt = `
You are a senior legal analyst specializing in contract version comparison for a Taiwanese company.

Your task is to compare two versions of a contract and produce a COMPLETE diff analysis in JSON format.

═══ STEP 0 (MANDATORY): SUBSTANTIVE-CONTENT IDENTITY CHECK ═══
Before any diff analysis, perform a substantive content identity check:
- Walk through every 條 (article) and 項 (item/paragraph) in BOTH versions.
- For each clause, compare only the SUBSTANTIVE WORDING (the actual legal content / obligations).
- Treat as IDENTICAL — and DO NOT report as MODIFIED — when only the following types of differences exist:
  (a) Whitespace, line breaks, full-width vs half-width spaces
  (b) Punctuation style (， vs , ; 「」 vs ""; 。 vs .)
  (c) Filename, version markers (V1/V2/V3/V4/V5), date stamps in header
  (d) Page numbers, headers, footers
  (e) Pure font/format/layout differences

If EVERY clause's substantive wording is identical (only differences are (a)-(e)), you MUST return:
{
    "summary": "兩版本條文內容完全相同，僅有檔名／版本／格式等非條文性差異，無任何條文實質變更。",
    "overallRiskLevel": "NONE",
    "totalChanges": 0,
    "addedClauses": 0,
    "removedClauses": 0,
    "modifiedClauses": 0,
    "majorRisks": [],
    "recommendations": [],
    "clauses": []
}
Do NOT proceed to STEP 1 if STEP 0 confirms no substantive change.
Do NOT fabricate clause differences just to "show work". Zero changes is a valid and important answer.

═══ STEP 0.5: WHAT COUNTS AS A REAL CLAUSE CHANGE ═══
A REAL clause change requires ONE of:
- A word/phrase added or deleted that alters obligations, rights, amounts, timing, parties, or scope
- An article number renumbered along with substantive renumbering downstream
- A whole article/clause/item added or removed

The following are NOT real changes and MUST be reported as UNCHANGED (or omitted):
- 「應」 vs 「應該」 with identical meaning
- 「甲方」 vs 「  甲方」 (whitespace)
- 「、」 vs 「,」 (punctuation only)
- "合約" vs "契約" if used interchangeably elsewhere
- Reflowed paragraphs where each line break moved but words are identical

═══ GRANULARITY REQUIREMENT (CRITICAL) ═══
Compare at the FINEST possible level:
- If a 條 (article) contains multiple 項 (items/paragraphs), treat each 項 as a SEPARATE entry when its content changed.
- If only part of a sentence was deleted or added, you MUST quote the EXACT deleted/added phrase.
- For MODIFIED entries: in oldText, wrap deleted phrases as 【刪除：「...」】; in newText, wrap added phrases as 【新增：「...」】 so reviewers can spot the exact change instantly.
- Never summarize away specific wording changes. If "並應盡量避免影響既有已確認之廣告合作案件" was deleted, it MUST appear in oldText with 【刪除：「...」】 marking.

═══ COMPLETENESS REQUIREMENT ═══
You MUST identify EVERY change in BOTH versions. Do NOT skip any clause or item.
Step 1: List ALL clause numbers/titles found in Version A.
Step 2: List ALL clause numbers/titles found in Version B.
Step 3: For each unique clause or item from either version, produce one entry.
- Version A only → changeType: "REMOVED"
- Version B only → changeType: "ADDED"
- Both, text differs → changeType: "MODIFIED"
- Both, text identical → changeType: "UNCHANGED"

Version A (舊版 / Old Version, normalized — whitespace/page numbers/version markers removed):
"""
${normalizedA.substring(0, 14000)}
"""

Version B (新版 / New Version, normalized):
"""
${normalizedB.substring(0, 14000)}
"""
${reviewSection}

═══ ANALYSIS INSTRUCTIONS ═══
- Match clauses by explicit clause number (第N條/第N項) first, then by semantic meaning.
- "oldText" / "newText": quote the ACTUAL clause/item text. For MODIFIED entries, use 【刪除：「...」】 and 【新增：「...」】 markers around the exact changed phrases.
- "impactDescription": describe the factual change and its legal/commercial implication (AI analysis, not legal opinion).
- "affectedRights": concrete rights/obligations of 甲方 impacted (Traditional Chinese).
- "impactLevel": HIGH = liability/payment/IP/termination/penalty; MEDIUM = procedural/timing; LOW = minor wording; NONE = unchanged.
- "reviewComment": if historical comments apply, note whether addressed. Otherwise null.
- All text fields in Traditional Chinese (繁體中文).
- Include UNCHANGED clauses ONLY if strategically important.

═══ OUTPUT FORMAT ═══
Return a JSON object:
{
    "summary": "2-3 sentence overall summary in Traditional Chinese",
    "overallRiskLevel": "HIGH",
    "totalChanges": 0,
    "addedClauses": 0,
    "removedClauses": 0,
    "modifiedClauses": 0,
    "majorRisks": ["risk description"],
    "recommendations": ["suggestion"],
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "第X條第X項 標題",
            "changeType": "MODIFIED",
            "oldText": "舊版文字，含【刪除：「...」】標記",
            "newText": "新版文字，含【新增：「...」】標記",
            "impactLevel": "MEDIUM",
            "impactDescription": "AI分析說明",
            "affectedRights": ["受影響項目"],
            "reviewComment": null
        }
    ]
}
`;

        const raw = await callOpenAI(prompt, apiKey, 16000, true);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[DiffService] Raw AI output length:', cleaned.length);

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');

        let parsed: ContractDiffResult;
        try {
            parsed = JSON.parse(jsonMatch[0]) as ContractDiffResult;
        } catch {
            // Fallback: strip trailing commas then retry
            const repaired = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
            parsed = JSON.parse(repaired) as ContractDiffResult;
        }
        return parsed;

    } catch (error: any) {
        console.error('[DiffService] Failed:', error);
        await logSystemEvent('DiffService', 'ERROR', `Contract diff failed: ${error.message}`);
        throw error;
    }
}
