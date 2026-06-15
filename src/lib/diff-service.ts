import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

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
        const reviewSection = reviewComments.trim().length > 0
            ? `\n\nHistorical Review Comments (過往審約意見):\n"""\n${reviewComments.substring(0, 3000)}\n"""\nFor each changed clause, note whether the review comments were addressed.`
            : '';

        const prompt = `
You are a senior legal analyst specializing in contract version comparison for a Taiwanese company.

Your task is to compare two versions of a contract and produce a COMPLETE diff analysis in JSON format.

═══ WHAT TO IGNORE (NOT clause changes) ═══
The following differences are NOT contract clause changes and must be IGNORED entirely:
- Document title / file name changes (e.g. "合約V4" → "合約V5", filename in header).
- Version numbers or dates appearing only in the document header or cover page.
- Page numbers, whitespace, line breaks, or pure formatting differences.
- Changes to the document's metadata section (封面、頁首、頁尾).

═══ NO-CHANGE SCENARIO ═══
If after ignoring the above, the two versions have IDENTICAL clause content, you MUST return:
{
    "summary": "兩版本條文內容完全相同，僅有檔案名稱或版本標示等非條文性差異，無任何條文實質變更。",
    "overallRiskLevel": "NONE",
    "totalChanges": 0,
    "addedClauses": 0,
    "removedClauses": 0,
    "modifiedClauses": 0,
    "majorRisks": [],
    "recommendations": [],
    "clauses": []
}
Do NOT fabricate clause differences. If only the filename or header changed, totalChanges MUST be 0.

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

Version A (舊版 / Old Version):
"""
${versionA.substring(0, 12000)}
"""

Version B (新版 / New版):
"""
${versionB.substring(0, 12000)}
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
