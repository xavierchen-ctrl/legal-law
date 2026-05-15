
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface AIRule {
    ruleName: string;
    promptInstruction: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    targetEmail: string;
    isActive: boolean;
}

// Reuse Auth logic 
async function getSheetsClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: (process.env.GOOGLE_CLIENT_EMAIL || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim(),
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth: client });
}

function getSpreadsheetId() {
    const csvUrl = process.env.SHEET_CSV_URL;
    if (!csvUrl) throw new Error('Missing SHEET_CSV_URL');
    const match = csvUrl.match(/\/d\/(.*?)(\/|$)/);
    return match ? match[1] : null;
}

export async function getAIRules(): Promise<AIRule[]> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return [];

        // Sheet: "AI_Rules"
        // Columns: A: RuleName, B: Prompt, C: RiskLevel, D: TargetEmail, E: IsActive
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'AI_Rules!A2:E',
        });

        const rows = response.data.values || [];
        return rows.map(row => ({
            ruleName: row[0] || 'Unnamed Rule',
            promptInstruction: row[1] || '',
            riskLevel: (row[2] as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
            targetEmail: row[3] || '',
            isActive: (row[4] || '').toUpperCase() === 'TRUE'
        })).filter(r => r.promptInstruction.trim() !== '');

    } catch (error) {
        console.warn('Error reading AI Rules (Sheet might not exist yet):', error);
        return [];
    }
}

export async function addAIRule(rule: AIRule) {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'AI_Rules!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                rule.ruleName,
                rule.promptInstruction,
                rule.riskLevel,
                rule.targetEmail,
                'TRUE'
            ]]
        }
    });
}

export async function updateAIRule(index: number, rule: AIRule) {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    // Index 0 -> Row 2
    const row = index + 2;
    const range = `AI_Rules!A${row}:E${row}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                rule.ruleName,
                rule.promptInstruction,
                rule.riskLevel,
                rule.targetEmail,
                'TRUE'
            ]]
        }
    });
}

export async function deleteAIRule(index: number) {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    // Need SheetId (Integer) for batchUpdate, not just name.
    // We assume "AI_Rules" is the sheet name. We need to find its gridId (sheetId).
    // This requires fetching spreadsheet metadata first.
    const metaStruct = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetObj = metaStruct.data.sheets?.find(s => s.properties?.title === 'AI_Rules');
    const sheetId = sheetObj?.properties?.sheetId;

    if (sheetId === undefined) {
        throw new Error('Sheet AI_Rules not found');
    }

    // Index 0 -> Row 2. 
    // deleteDimension uses 0-based index for the *sheet*, so Row 1 is index 0.
    // Data starts at Row 2 (index 1).
    // So index 0 (data) -> sheet index 1.
    const startIndex = index + 1;
    const endIndex = startIndex + 1;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: startIndex,
                        endIndex: endIndex
                    }
                }
            }]
        }
    });
}
