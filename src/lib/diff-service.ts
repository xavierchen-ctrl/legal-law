import { logSystemEvent } from './logger';
import { callOpenAI } from './openai-client';

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type OurRole = 'PARTY_A' | 'PARTY_B' | 'AUTO';
export type ResolvedRole = 'PARTY_A' | 'PARTY_B' | 'UNCLEAR';
export type RiskDirection =
    | 'INCREASE_OUR_RISK'         // 對我方不利（責任增加／權利減少／風險移轉至我方）
    | 'DECREASE_OUR_RISK'         // 對我方有利（責任減少／權利增加／風險移轉至相對人）
    | 'NEUTRAL'                   // 對雙方平衡或中性影響
    | 'UNCLEAR';                  // 影響方向不明確

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

function buildNoChangeResult(reason: string, resolvedRole: ResolvedRole = 'UNCLEAR'): ContractDiffResult {
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
        resolvedRole,
        roleResolution: '無實質變更，未需角色判讀。',
        ourSideSummary: '兩版本條文實質內容相同，我方權利義務無變化。',
        counterpartyImpactSummary: '相對人權利義務亦無變化。',
    };
}

function rolePromptSection(ourRole: OurRole): string {
    if (ourRole === 'PARTY_A') {
        return `
═══ 我方角色（使用者指定）═══
我方為「甲方」。所有風險方向、權利義務變化均須從甲方角度判讀。
- 相對人（乙方）責任「增加」或「保證義務加強」→ 對我方有利（DECREASE_OUR_RISK）
- 相對人（乙方）責任「減輕」、違約金被刪除或加限制條件 → 對我方不利（INCREASE_OUR_RISK）
- 我方（甲方）承擔之義務增加或限制要件提高 → 對我方不利（INCREASE_OUR_RISK）
- 我方（甲方）權利擴張或保障增強 → 對我方有利（DECREASE_OUR_RISK）`;
    }
    if (ourRole === 'PARTY_B') {
        return `
═══ 我方角色（使用者指定）═══
我方為「乙方」。所有風險方向、權利義務變化均須從乙方角度判讀。
- 相對人（甲方）責任「增加」或保障義務加強 → 對我方有利（DECREASE_OUR_RISK）
- 相對人（甲方）責任「減輕」 → 對我方不利（INCREASE_OUR_RISK）
- 我方（乙方）承擔之義務增加、違約金或賠償責任擴大 → 對我方不利（INCREASE_OUR_RISK）
- 我方（乙方）責任被限縮、違約金被刪除、賠償條件加上「具體事證／限期改善／因果關係」等限制 → 對我方有利（DECREASE_OUR_RISK）`;
    }
    return `
═══ 我方角色（AI 自動判斷）═══
請從合約文字（標題、前言、給付方向、簽署人位置）判斷我方角色：
- 若我方為買方／業主／需求方／使用方 → PARTY_A（多數情境）
- 若我方為供應商／服務提供者／受託人／承攬人 → PARTY_B
- 若文字不明確 → 標示 resolvedRole = "UNCLEAR" 並於 roleResolution 中說明，所有條款仍嘗試從雙方視角分別評估
請於 resolvedRole 欄位回傳結論（PARTY_A / PARTY_B / UNCLEAR）並依該角色判讀風險方向。
重要原則：相對人責任「減輕」≠ 我方風險增加；只有當該減輕「直接削弱我方的救濟手段」或「移轉風險至我方」時，才算 INCREASE_OUR_RISK。`;
}

export interface ClauseDiff {
    id: number;
    clauseTitle: string;
    changeType: ChangeType;
    oldText: string | null;
    newText: string | null;
    impactLevel: ImpactLevel;
    impactDescription: string;          // 客觀變動內容說明（不帶角色立場）
    affectedRights: string[];
    reviewComment: string | null;
    riskDirection: RiskDirection;        // 對我方的方向
    ourSideImpact: string;               // 我方視角影響：權利義務／風險變化說明
    counterpartyImpact: string;          // 相對人視角影響：權利義務／風險變化說明
}

export interface ContractDiffResult {
    summary: string;
    overallRiskLevel: RiskLevel;          // 對「我方」的整體風險等級
    totalChanges: number;
    addedClauses: number;
    removedClauses: number;
    modifiedClauses: number;
    majorRisks: string[];                  // 對我方之主要風險
    recommendations: string[];
    clauses: ClauseDiff[];
    resolvedRole: ResolvedRole;            // 本次分析所採用之我方角色
    roleResolution: string;                // 角色判斷說明（使用者指定／AI 偵測）
    ourSideSummary: string;                // 我方視角整體摘要
    counterpartyImpactSummary: string;     // 相對人視角整體摘要
}

export async function compareContractVersions(
    versionA: string,
    versionB: string,
    reviewComments: string,
    ourRole: OurRole = 'AUTO',
    apiKey?: string
): Promise<ContractDiffResult> {
    try {
        // ── Short-circuit 1：內容雜湊比對 ──
        const fpA = contentFingerprint(versionA);
        const fpB = contentFingerprint(versionB);
        if (fpA === fpB && fpA.length > 0) {
            console.log('[DiffService] Short-circuit: content fingerprints identical, no AI call needed.');
            await logSystemEvent('DiffService', 'INFO', 'Content fingerprints identical — short-circuit no-change result.');
            return buildNoChangeResult(
                '兩版本去除檔名、版本標示、頁碼及空白後條文內容完全相同，無任何條文實質變更。' +
                '（系統先以內容雜湊比對，未呼叫 AI，避免格式雜訊影響判讀。）',
                ourRole === 'PARTY_A' ? 'PARTY_A' : ourRole === 'PARTY_B' ? 'PARTY_B' : 'UNCLEAR'
            );
        }

        // ── Short-circuit 2：高相似度（>99%）通常為純格式差異 ──
        const minLen = Math.min(fpA.length, fpB.length);
        const maxLen = Math.max(fpA.length, fpB.length);
        const lenRatio = maxLen > 0 ? minLen / maxLen : 1;
        if (lenRatio > 0.995) {
            let diff = 0;
            for (let i = 0; i < minLen; i++) if (fpA[i] !== fpB[i]) diff++;
            const diffRatio = maxLen > 0 ? diff / maxLen : 0;
            if (diffRatio < 0.005) {
                console.log(`[DiffService] Short-circuit: ${(diffRatio * 100).toFixed(3)}% char diff, treating as no-change.`);
                return buildNoChangeResult(
                    '兩版本條文內容差異低於 0.5%（多為標點、空白或排版細節），無實質條文變更。' +
                    '若您認為應有實質差異，請改用「貼上文字」模式重新比對。',
                    ourRole === 'PARTY_A' ? 'PARTY_A' : ourRole === 'PARTY_B' ? 'PARTY_B' : 'UNCLEAR'
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

${rolePromptSection(ourRole)}

═══ KEY ANALYTICAL PRINCIPLE — DIRECTION-AWARE RISK ═══
For EVERY identified change, you MUST analyze TWO perspectives separately:
  (1) 我方視角 (ourSideImpact)   — 對我方而言：權利義務如何變化？風險是增加還是減少？
  (2) 相對人視角 (counterpartyImpact) — 對相對人而言：權利義務如何變化？

Then classify riskDirection based on EFFECT TO OUR SIDE:
  - INCREASE_OUR_RISK: 我方責任擴大、權利縮減、救濟手段被削弱、風險被移轉至我方
  - DECREASE_OUR_RISK: 我方責任縮減、權利擴張、保障增強、風險被移轉至相對人
  - NEUTRAL:           雙方平衡修訂或對我方影響中性
  - UNCLEAR:           方向因角色不明而無法判讀

⚠️ ANTI-PATTERN TO AVOID（過往常犯錯誤）:
僅憑「相對人責任減輕／違約金被刪除／賠償條件加限制」就判 INCREASE_OUR_RISK 是錯的。
請依下列規則判斷：
- 相對人責任「減輕」 → 對我方而言通常為 INCREASE_OUR_RISK（因為相對人對我方的保證義務／賠償責任降低，我方失去原有保護）
- 相對人責任「加強」 → 對我方而言通常為 DECREASE_OUR_RISK（因為相對人對我方的保證義務／賠償責任提高，我方獲得更好保護）
- 我方責任「減輕」（如：違約金被刪除、賠償條件加上「具體事證、限期改善、相當因果關係」等限制） → 對我方有利 DECREASE_OUR_RISK
- 我方責任「加強」 → 對我方不利 INCREASE_OUR_RISK
判斷時必須先確認：「這條變動讓【我方】的責任／權利／風險增加還是減少？」絕不可只看相對人視角。

具體例子（W260123 V1→V2 真實案例之正確判讀）：
若我方為「業主／需求方（甲方）」，相對人為「供應商（乙方）」：
- 第2條新增「具體事證、書面通知、限期改善、相當因果關係」等啟動賠償的限制條件 → 是相對人責任減輕 → 我方追究賠償變困難 → INCREASE_OUR_RISK
- 第2條刪除「三倍合作金額或 RMB 10 萬元」之違約金機制 → 相對人賠償上限／違約金被取消 → 我方喪失明確賠償基礎 → INCREASE_OUR_RISK

若我方為「供應商（乙方）」，相對人為「業主（甲方）」：
- 同樣修訂 → 我方（乙方供應商）責任降低、賠償基礎被刪除 → DECREASE_OUR_RISK
換言之：相同的修訂，因角色不同，方向會完全相反。請務必先確認 resolvedRole 再判讀方向。

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
    "summary": "2-3 sentence overall summary in Traditional Chinese — 從我方視角",
    "overallRiskLevel": "HIGH|MEDIUM|LOW|NONE — 對我方的整體風險等級",
    "totalChanges": 0,
    "addedClauses": 0,
    "removedClauses": 0,
    "modifiedClauses": 0,
    "majorRisks": ["從我方視角列出主要風險"],
    "recommendations": ["建議事項"],
    "resolvedRole": "PARTY_A | PARTY_B | UNCLEAR",
    "roleResolution": "中文說明：如「使用者指定我方為甲方」或「AI 依合約前言判斷我方為甲方（業主）」",
    "ourSideSummary": "我方視角整體摘要（2-3 句）：本次修訂對我方權利義務的總體影響方向",
    "counterpartyImpactSummary": "相對人視角整體摘要（2-3 句）：本次修訂對相對人權利義務的總體影響方向",
    "clauses": [
        {
            "id": 1,
            "clauseTitle": "第X條第X項 標題",
            "changeType": "MODIFIED",
            "oldText": "舊版文字，含【刪除：「...」】標記",
            "newText": "新版文字，含【新增：「...」】標記",
            "impactLevel": "MEDIUM",
            "impactDescription": "客觀變動內容說明（不帶角色立場）",
            "ourSideImpact": "我方視角：本變動如何影響我方權利義務／風險（例：『我方追究違約賠償變得更困難，須先發書面通知、給予改善期、證明因果關係，且失去原本的違約金條款保障』）",
            "counterpartyImpact": "相對人視角：本變動如何影響相對人權利義務／風險（例：『相對人責任降低，賠償觸發條件變嚴格，失去原本的固定違約金風險』）",
            "riskDirection": "INCREASE_OUR_RISK | DECREASE_OUR_RISK | NEUTRAL | UNCLEAR",
            "affectedRights": ["受影響之具體權利或義務項目"],
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

        let parsed: any;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch {
            const repaired = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
            parsed = JSON.parse(repaired);
        }

        // 補齊新欄位（向後相容）
        const result: ContractDiffResult = {
            summary: parsed.summary ?? '',
            overallRiskLevel: (parsed.overallRiskLevel ?? 'MEDIUM') as RiskLevel,
            totalChanges: parsed.totalChanges ?? 0,
            addedClauses: parsed.addedClauses ?? 0,
            removedClauses: parsed.removedClauses ?? 0,
            modifiedClauses: parsed.modifiedClauses ?? 0,
            majorRisks: Array.isArray(parsed.majorRisks) ? parsed.majorRisks : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            clauses: Array.isArray(parsed.clauses) ? parsed.clauses.map((c: any) => ({
                id: c.id,
                clauseTitle: c.clauseTitle ?? '',
                changeType: (c.changeType ?? 'UNCHANGED') as ChangeType,
                oldText: c.oldText ?? null,
                newText: c.newText ?? null,
                impactLevel: (c.impactLevel ?? 'NONE') as ImpactLevel,
                impactDescription: c.impactDescription ?? '',
                affectedRights: Array.isArray(c.affectedRights) ? c.affectedRights : [],
                reviewComment: c.reviewComment ?? null,
                riskDirection: (c.riskDirection ?? 'UNCLEAR') as RiskDirection,
                ourSideImpact: c.ourSideImpact ?? '',
                counterpartyImpact: c.counterpartyImpact ?? '',
            })) : [],
            resolvedRole: (parsed.resolvedRole ?? 'UNCLEAR') as ResolvedRole,
            roleResolution: parsed.roleResolution ?? '',
            ourSideSummary: parsed.ourSideSummary ?? '',
            counterpartyImpactSummary: parsed.counterpartyImpactSummary ?? '',
        };
        return result;

    } catch (error: any) {
        console.error('[DiffService] Failed:', error);
        await logSystemEvent('DiffService', 'ERROR', `Contract diff failed: ${error.message}`);
        throw error;
    }
}
