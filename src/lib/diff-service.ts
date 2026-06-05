import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

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

Your task is to compare two versions of a contract and produce a COMPLETE diff analysis.

═══ COMPLETENESS REQUIREMENT (CRITICAL) ═══
You MUST identify and process EVERY clause in BOTH versions. Do NOT skip any clause.
Step 1: List ALL clause numbers/titles found in Version A.
Step 2: List ALL clause numbers/titles found in Version B.
Step 3: For each unique clause from either version, produce one entry in the output.
If a clause appears in Version A but not Version B → changeType: "REMOVED"
If a clause appears in Version B but not Version A → changeType: "ADDED"
If a clause appears in both but text differs → changeType: "MODIFIED"
If a clause appears in both and text is identical → changeType: "UNCHANGED"
Do not merge or skip clauses. Every clause number must appear in the output.

Version A (舊版 / Old Version):
"""
${versionA.substring(0, 13000)}
"""

Version B (新版 / New Version):
"""
${versionB.substring(0, 13000)}
"""
${reviewSection}

═══ ANALYSIS INSTRUCTIONS ═══
- Match clauses by explicit clause number (第N條) first, then by title or semantic meaning.
- For MODIFIED clauses: quote the specific changed text, then analyze legal effect.
- "impactDescription": describe the factual change and its legal/commercial implication — clearly note this is AI analysis, not a legal opinion.
- "affectedRights": list concrete rights/obligations of our party (甲方) impacted (in Traditional Chinese).
- "impactLevel": HIGH = liability, payment, IP, termination, penalty; MEDIUM = procedural/timing; LOW = minor wording; NONE = unchanged.
- "reviewComment": if historical review comments are provided and this clause was mentioned, summarize whether the concern was addressed. Otherwise null.
- All text fields must be in Traditional Chinese (繁體中文).
- Include UNCHANGED clauses ONLY if strategically important.

═══ OUTPUT FORMAT ═══
Return ONLY a raw JSON object (no markdown):
{
    "summary": "2-3 sentence overall summary of the changes and risk direction in Traditional Chinese",
    "overallRiskLevel": "HIGH" | "MEDIUM" | "LOW",
    "totalChanges": <ADDED + REMOVED + MODIFIED count>,
    "addedClauses": <count>,
    "removedClauses": <count>,
    "modifiedClauses": <count>,
    "majorRisks": ["Risk description in Chinese"],
    "recommendations": ["Amendment suggestion in Chinese"],
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "條款標題（如：第三條 付款條件）",
            "changeType": "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED",
            "oldText": "Original clause text verbatim, or null if ADDED",
            "newText": "New clause text verbatim, or null if REMOVED",
            "impactLevel": "HIGH" | "MEDIUM" | "LOW" | "NONE",
            "impactDescription": "AI分析：條文異動說明及對我方權利義務之影響推論（繁體中文）",
            "affectedRights": ["具體受影響的權利或義務項目"],
            "reviewComment": "審約意見追蹤說明，或 null"
        }
    ]
}
`;

        const raw = await callOpenAI(prompt, apiKey, 16000);
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log('[DiffService] Raw AI output length:', cleaned.length);

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 回應格式錯誤');
        return JSON.parse(jsonMatch[0]) as ContractDiffResult;

    } catch (error: any) {
        console.error('[DiffService] Failed:', error);
        await logSystemEvent('DiffService', 'ERROR', `Contract diff failed: ${error.message}`);
        throw error;
    }
}
