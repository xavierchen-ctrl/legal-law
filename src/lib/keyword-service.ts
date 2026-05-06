import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// --- Interfaces ---
export interface KeywordRule {
    keyword: string;
    targetEmail: string;
    description: string;
    isActive: boolean;
}

export interface ScanRecord {
    fileId: string;
    fileName: string;
    scannedAt: string;
    matchesFound: string; // Comma separated keywords
}

// --- Auth Helper (Reusing similar logic from logger.ts) ---
async function getSheetsClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim(),
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

// --- Keyword Operations ---

export async function getKeywords(): Promise<KeywordRule[]> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return [];

        // Assuming stored in "Keyword_Rules!A:D"
        // A: Keyword, B: TargetEmail, C: Description, D: IsActive (TRUE/FALSE)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Keyword_Rules!A2:D',
        });

        const rows = response.data.values || [];
        return rows.map(row => ({
            keyword: row[0] || '',
            targetEmail: row[1] || '',
            description: row[2] || '',
            isActive: (row[3] || '').toUpperCase() === 'TRUE'
        })).filter(k => k.keyword.trim() !== '');

    } catch (error) {
        console.warn('Error reading keywords (Sheet might not exist yet):', error);
        return [];
    }
}

export async function addKeyword(rule: KeywordRule) {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Keyword_Rules!A:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[rule.keyword, rule.targetEmail, rule.description, 'TRUE']]
        }
    });
}

export async function deleteKeyword(keyword: string) {
    // Note: Deleting rows via API is complex (need to find row index). 
    // For MVP, we might just let users manage it in Sheet, or implement a soft delete if needed.
    // For this implementation, I will skip DELETE via API to simplify, prompting users to edit Sheet for deletion.
    console.log('Delete not implemented via API, please edit Sheet directly.');
}

// --- History Operations ---

export async function getProcessedFileIds(): Promise<Set<string>> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            throw new Error("Spreadsheet ID not found or configured.");
        }

        // Assuming stored in "Scan_History!A:A" (File ID)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Scan_History!A2:A',
        });

        // CRITICAL FIX: If we get a response but 'values' is undefined, it might mean the sheet is empty OR an error occurred silently.
        // However, if the API call itself threw an error, we catch it below.
        // The main risk is catching an error and returning new Set(), which wipes history memory.

        const rows = response.data.values || [];
        const ids = new Set<string>();
        rows.forEach(r => { if (r[0]) ids.add(r[0]); });
        return ids;

    } catch (error) {
        console.error('CRITICAL: Failed to read scan history:', error);
        // Do NOT return empty set. Throw error to stop the scan.
        throw new Error(`Failed to retrieve processed file IDs: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export interface ScanHistoryItem {
    fileId: string;
    fileName: string;
    scannedAt: string;
    matches: string;
    link: string;
    status: 'Unreviewed' | 'In Review' | 'Reviewed';
}

export async function getScanResults(): Promise<ScanHistoryItem[]> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return [];

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Scan_History!A2:F', // Extend range to F for Link & Status
        });

        const rows = response.data.values || [];
        return rows.map(row => ({
            fileId: row[0] || '',
            fileName: row[1] || '',
            scannedAt: row[2] || '',
            matches: row[3] || '',
            link: row[4] || '',
            status: (row[5] as any) || 'Unreviewed'
        })).filter(r => r.fileId !== '');

    } catch (error) {
        console.warn('Error reading history:', error);
        return [];
    }
}

export async function logScanResult(fileId: string, fileName: string, matches: string[], link: string = '') {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const matchesStr = matches.length > 0 ? matches.join(', ') : 'None';
    const status = 'Unreviewed';

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Scan_History!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[fileId, fileName, timestamp, matchesStr, link, status]]
        }
    });
}

export async function updateScanStatus(fileId: string, newStatus: string) {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return;

    // 1. Find the row index for this fileId
    // This is inefficient (O(N) read), but fine for <10k rows. 
    // In a real DB we'd use SQL. Here we scan column A.
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Scan_History!A:A',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === fileId);

    if (rowIndex === -1) {
        console.warn(`File ID ${fileId} not found in history.`);
        return;
    }

    // Row index is 0-based in array, but 1-based in Sheet.
    // Also A is used. Status is Column F (6th column).
    // Sheet Row = rowIndex + 1.
    const range = `Scan_History!F${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[newStatus]]
        }
    });
}
