import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

const cleanKey = (key: string | undefined) => (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

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
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    if (!effectiveKey) throw new Error('Missing GEMINI_API_KEY');

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const reviewSection = reviewComments.trim().length > 0
            ? `\n\nHistorical Review Comments (過往審約意見):\n"""\n${reviewComments.substring(0, 3000)}\n"""\nFor each changed clause, note whether the review comments were addressed.`
            : '';

        const prompt = `
You are a senior legal analyst specializing in contract version comparison for a Taiwanese company.

Your task is to compare two versions of a contract and produce a detailed diff analysis covering:
1. Clause-level changes (added, removed, modified, unchanged)
2. Impact on our party's (甲方 / our company) rights and obligations
3. Risk assessment for each change
4. Whether historical review comments were addressed (if provided)

Version A (舊版 / Old Version):
"""
${versionA.substring(0, 13000)}
"""

Version B (新版 / New Version):
"""
${versionB.substring(0, 13000)}
"""
${reviewSection}

Instructions:
- Identify ALL clauses from both versions. Match clauses by title/number or semantic meaning.
- For MODIFIED clauses, focus on the specific text that changed and its legal effect.
- "affectedRights" should list concrete rights/obligations of our party that are impacted (in Traditional Chinese).
- "impactLevel": HIGH = significant change to liability, payment, IP, termination; MEDIUM = procedural or timing changes; LOW = minor wording; NONE = unchanged.
- "reviewComment": if historical review comments were provided and this clause was mentioned, summarize whether the concern was addressed. Otherwise null.
- The "summary" and all descriptions must be in Traditional Chinese (繁體中文).
- Only include clauses with changeType "UNCHANGED" if they are strategically important.

Output Format:
Return ONLY a raw JSON object (no markdown). Structure:
{
    "summary": "2-3 sentence overall summary of the changes and risk direction in Traditional Chinese",
    "overallRiskLevel": "HIGH" | "MEDIUM" | "LOW",
    "totalChanges": <number of ADDED + REMOVED + MODIFIED>,
    "addedClauses": <count>,
    "removedClauses": <count>,
    "modifiedClauses": <count>,
    "majorRisks": ["Risk description 1 in Chinese", "Risk description 2 in Chinese"],
    "recommendations": ["Action item 1 in Chinese", "Action item 2 in Chinese"],
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "條款標題（如：第三條 付款條件）",
            "changeType": "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED",
            "oldText": "Original clause text, or null if ADDED",
            "newText": "New clause text, or null if REMOVED",
            "impactLevel": "HIGH" | "MEDIUM" | "LOW" | "NONE",
            "impactDescription": "說明此變動對我方權利義務的影響（繁體中文）",
            "affectedRights": ["具體受影響的權利或義務項目"],
            "reviewComment": "審約意見是否已被採納的說明，或 null"
        }
    ]
}
`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('[DiffService] Raw AI output length:', responseText.length);
        const parsed = JSON.parse(responseText) as ContractDiffResult;
        return parsed;

    } catch (error: any) {
        console.error('[DiffService] Failed:', error);
        await logSystemEvent('DiffService', 'ERROR', `Contract diff failed: ${error.message}`);
        throw error;
    }
}
