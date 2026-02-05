import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetContract {
    id: string; // Map from 合約編號
    contractNumber: string;
    requestDate: string;
    department: string;
    requester: string;
    requesterEmail?: string;
    counterparty: string;
    documentName: string;
    priority: 'URGENT' | 'NORMAL';
    status: string;
    estimatedReplyDate: string | null;
    lastReplyDate: string | null;
}

// Reuse Auth logic
export async function getSheetsClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Read-only is enough for fetching contracts
    });

    return google.sheets({ version: 'v4', auth: client });
}

export function getSpreadsheetId() {
    const csvUrl = process.env.SHEET_CSV_URL;
    if (!csvUrl) throw new Error('Missing SHEET_CSV_URL');
    const match = csvUrl.match(/\/d\/(.*?)(\/|$)/);
    return match ? match[1] : null; // Extract ID from URL even if CSV feature is disabled
}

export async function fetchContractsFromSheet(): Promise<SheetContract[]> {
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        if (!spreadsheetId) {
            console.error('Invalid Spreadsheet ID extraction');
            return [];
        }

        // Fetch all data from the first sheet (gid=0 usually implies first tab, but API uses name or "Sheet1")
        // Since we don't know the exact tab name, we'll try to list sheets or assume "表單回應 1" (common for Forms) or just range 'A:Z' if single sheet.
        // Safer: Get spreadsheet metadata to find the Sheet Name corresponding to the main data.
        // But for speed, let's assume the data is on the first available sheet or try a broad range.
        // Let's try fetching the spreadsheet detail first to get the first sheet's name.

        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetName = meta.data.sheets?.[0]?.properties?.title;

        if (!sheetName) throw new Error('No sheets found');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`, // Fetch columns A to Z (should cover mostly everything)
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        // 1. Find Header Row
        let headerRowIndex = -1;
        const targetHeader = '合約編號'; // Relaxed match to handle newlines or slash variants

        for (let i = 0; i < rows.length; i++) {
            if (rows[i].some((cell: string) => cell && cell.includes(targetHeader))) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            console.error('Could not find header row in Sheet');
            return [];
        }

        const headers = rows[headerRowIndex].map((h: string) => h.trim());
        const dataRows = rows.slice(headerRowIndex + 1);

        // Map Helper
        const getValue = (row: any[], headerNamePartial: string) => {
            const index = headers.findIndex((h: string) => h.includes(headerNamePartial));
            if (index === -1) return '';
            return row[index] || '';
        };

        return dataRows.map((row, index) => {
            const rawCNum = getValue(row, '合約編號') || getValue(row, '取單號');
            const rawDocName = getValue(row, '文件名稱');

            const cNum = rawCNum ? rawCNum.trim() : '';
            const docName = rawDocName ? rawDocName.trim() : '';

            // Skip empty rows (even if they have spaces)
            if (!cNum && !docName) return null;

            const contractNumber = cNum || `UNKNOWN-${index}`;
            const priorityCell = getValue(row, '急件');
            const priority = priorityCell.includes('急件') ? 'URGENT' : 'NORMAL';

            const statusRaw = getValue(row, '狀態選單') || getValue(row, '審閱進度');
            let status = 'SUBMITTED';

            if (statusRaw.includes('已結案') || statusRaw.includes('完成') || statusRaw.includes('結案')) {
                status = 'CLOSED';
            } else if (statusRaw.includes('暫停')) {
                status = 'PAUSED';
            } else if (statusRaw.includes('待需求單位回覆') || statusRaw.includes('待回覆')) {
                status = 'AWAITING_FEEDBACK';
            } else if (statusRaw.includes('法務審閱中') || statusRaw.includes('審閱中')) {
                status = 'IN_REVIEW';
            }

            // Find Latest Reply Date
            let lastReplyDate = null;

            // Logic: Find all columns that match "回覆日" or "回覆日期" (but exclude "預計")
            // The sheet has multiple columns (K, L, M...) named "回覆日".
            const replyIndices = headers
                .map((h: string, i: number) => ({ h, i }))
                .filter(item => {
                    const h = item.h;
                    return (h.includes('回覆日') || h.includes('回覆日期')) && !h.includes('預計');
                })
                .map(item => item.i);

            // Iterate through these columns in the row
            for (const idx of replyIndices) {
                const val = row[idx];
                if (val && val.trim() !== '' && val.trim() !== '-') {
                    // We found a reply date.
                    // Since we want the *latest* one, and usually they are filled left-to-right (K->L->M),
                    // we can keep updating lastReplyDate.
                    lastReplyDate = val.trim();
                }
            }

            return {
                id: contractNumber,
                contractNumber,
                requestDate: getValue(row, '申請日期'),
                department: getValue(row, '需求單位'),
                requester: getValue(row, '申請人'),
                counterparty: getValue(row, '相對人'),
                documentName: docName,
                priority,
                status,
                estimatedReplyDate: getValue(row, '預計回覆日') || null,
                lastReplyDate,
            };
        }).filter(item => item !== null) as SheetContract[];

    } catch (error) {
        console.error('Error fetching sheet via API:', error);
        return [];
    }
}
