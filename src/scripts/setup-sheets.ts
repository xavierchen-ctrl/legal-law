
import 'dotenv/config'; // Load env vars
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Reuse Auth logic
async function getSheetsClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

async function setupSheets() {
    console.log('Starting Google Sheets Setup...');
    try {
        const sheets = await getSheetsClient();
        const spreadsheetId = getSpreadsheetId();

        if (!spreadsheetId) {
            console.error('Could not parse Spreadsheet ID from URL');
            return;
        }

        console.log(`Connecting to Spreadsheet: ${spreadsheetId}`);

        // 1. Get existing sheets
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const existingTitles = new Set(meta.data.sheets?.map(s => s.properties?.title) || []);

        console.log('Existing Sheets:', Array.from(existingTitles).join(', '));

        const sheetsToCreate = [
            { title: 'Keyword_Rules', headers: ['Keyword', 'TargetEmail', 'Description', 'IsActive'] },
            { title: 'Scan_History', headers: ['FileID', 'FileName', 'Timestamp', 'Matches'] },
            { title: 'AI_Rules', headers: ['Rule_Name', 'Prompt', 'Risk_Level', 'Target_Email', 'Is_Active'] }
        ];

        const requests: any[] = [];

        for (const sheet of sheetsToCreate) {
            if (!existingTitles.has(sheet.title)) {
                console.log(`Queueing creation for: ${sheet.title}`);
                requests.push({
                    addSheet: {
                        properties: { title: sheet.title }
                    }
                });
            } else {
                console.log(`Skipping ${sheet.title} (Already exists)`);
            }
        }

        if (requests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests }
            });
            console.log('✅ Created missing sheets.');
        }

        // 2. Add Headers (Append if empty)
        // Note: Simple check won't detect if ONLY header is missing but sheet exists.
        // We will blind append row 1 for newly created sheets?
        // Actually, let's just loop and try to update A1:E1 if needed.
        // For simplicity: If we just created it, we write headers.
        // But since `batchUpdate` doesn't return easy handles and we loop again...

        // Let's just write headers for ALL target sheets if looking at A1 returns empty.
        for (const sheet of sheetsToCreate) {
            const check = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheet.title}!A1:E1`
            });

            if (!check.data.values || check.data.values.length === 0) {
                console.log(`Writing headers for ${sheet.title}...`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheet.title}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [sheet.headers] }
                });
            }
        }

        console.log('🎉 Setup Complete!');

    } catch (error) {
        console.error('Setup Failed:', error);
    }
}

setupSheets();
