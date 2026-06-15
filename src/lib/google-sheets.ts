import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetContract {
    id: string; // Map from 合約編號
    contractNumber: string;
    requestDate: string;
    department: string;
    requester: string;
    requesterEmail?: string;
    supervisorEmail?: string;
    counterparty: string;
    businessNo: string;   // 統一編號（8碼），可為空
    documentName: string;
    priority: 'URGENT' | 'NORMAL';
    status: string;
    isArchived: boolean;       // V欄結案原因有值（獨立於J欄案件狀態）
    stampCompleted: boolean;   // Y/Z欄用印完成
    stampInProgress: boolean;  // Y/Z欄有值但未完成（待用印）
    stampCompletedDate: string | null; // X欄：雙方實際完成用印日期
    estimatedReplyDate: string | null;
    lastReplyDate: string | null;
}

function cleanEnvString(raw: string | undefined): string {
    return (raw || '')
        .replace(/^﻿/, '')      // 去除 BOM 字元
        .replace(/^["']|["']$/g, '') // 去除 Vercel 可能帶入的外層引號
        .trim();
}

function parsePrivateKey(raw: string | undefined): string {
    return cleanEnvString(raw)
        .replace(/\\n/g, '\n'); // 將 \n 轉成真正換行
}

// Reuse Auth logic
export async function getSheetsClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: cleanEnvString(process.env.GOOGLE_CLIENT_EMAIL),
        key: parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
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
        const TARGET_GID = 1607545574;
        const targetSheet = meta.data.sheets?.find(
            s => s.properties?.sheetId === TARGET_GID
        ) ?? meta.data.sheets?.[0];
        const sheetName = targetSheet?.properties?.title;

        if (!sheetName) throw new Error('No sheets found');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:AZ`, // Fetch columns A to AZ (52 columns, covers future expansion)
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
            const priorityCell = getValue(row, '急迫性');
            const priority = priorityCell.includes('急件') ? 'URGENT' : 'NORMAL';

            const statusRaw = getValue(row, '案件狀態') || getValue(row, '狀態選單') || getValue(row, '審閱進度');
            let status = 'SUBMITTED';

            if (statusRaw.includes('已結案') || statusRaw.includes('結案')) {
                status = 'CLOSED';
            } else if (statusRaw.includes('暫停')) {
                status = 'PAUSED';
            } else if (statusRaw.includes('待需求單位回覆') || statusRaw.includes('待回覆')) {
                status = 'AWAITING_FEEDBACK';
            } else if (statusRaw.includes('法務審閱中') || statusRaw.includes('審閱中')) {
                status = 'IN_REVIEW';
            }

            // V 欄結案原因：獨立判斷是否已歸檔（不影響 J 欄的 status）
            const archiveCell = getValue(row, '結案原因');
            const isArchived = archiveCell.includes('已取得簽署完成之合約文件') || archiveCell.includes('案件撤回');

            // Y、Z 欄：用印完成判斷
            // Y欄（紙本）：可為「是」或「無紙本作業，以線上簽署方式為之。」
            // Z欄（電子檔掃描）：只能為「是」
            const yVal = getValue(row, '紙本是否').trim();
            const zVal = getValue(row, '是否已完成').trim();
            const yDone = yVal === '是' || yVal === '無紙本作業，以線上簽署方式為之。';
            const zDone = zVal === '是';
            const stampCompleted = yDone && zDone;
            // Y 或 Z 有任何非空白/非否的值，視為用印進行中（待用印）
            const stampInProgress = !stampCompleted && (
                (yVal !== '' && yVal !== '否') || (zVal !== '' && zVal !== '否')
            );

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

            // 讀取申請人 Email（欄位名稱含「申請人」且含「mail」或「信箱」）
            const requesterEmailIdx = headers.findIndex((h: string) =>
                (h.includes('申請人') && (h.toLowerCase().includes('mail') || h.includes('信箱'))) ||
                h.includes('申請人email') || h.includes('申請人Email')
            );
            const requesterEmail = requesterEmailIdx !== -1 ? (row[requesterEmailIdx] || '').trim() : '';

            // 讀取直屬主管 Email（欄位名稱含「主管」且含「mail」或「信箱」）
            const supervisorEmailIdx = headers.findIndex((h: string) =>
                (h.includes('主管') && (h.toLowerCase().includes('mail') || h.includes('信箱'))) ||
                h.includes('主管email') || h.includes('主管Email')
            );
            const supervisorEmail = supervisorEmailIdx !== -1 ? (row[supervisorEmailIdx] || '').trim() : '';

            return {
                id: contractNumber,
                contractNumber,
                requestDate: getValue(row, '申請日期'),
                department: getValue(row, '需求單位'),
                requester: getValue(row, '申請人'),
                requesterEmail: requesterEmail || undefined,
                supervisorEmail: supervisorEmail || undefined,
                counterparty: getValue(row, '相對人'),
                businessNo: getValue(row, '統一編號'),
                documentName: docName,
                priority,
                status,
                isArchived,
                stampCompleted,
                stampInProgress,
                stampCompletedDate: getValue(row, '完成用印日期').trim() || null,
                estimatedReplyDate: getValue(row, '預計回覆日') || null,
                lastReplyDate,
            };
        }).filter(item => item !== null) as SheetContract[];

    } catch (error) {
        console.error('Error fetching sheet via API:', error);
        return [];
    }
}
