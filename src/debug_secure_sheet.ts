import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function debugSecureSheet() {
    console.log('--- STARTING SECURE SHEET DEBUG ---');
    try {
        if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            throw new Error('Missing Google Credentials');
        }

        const client = new JWT({
            email: process.env.GOOGLE_CLIENT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth: client });

        // Extract Spreadsheet ID
        const csvUrl = process.env.SHEET_CSV_URL;
        const match = csvUrl?.match(/\/d\/(.*?)(\/|$)/);
        const spreadsheetId = match ? match[1] : null;

        if (!spreadsheetId) throw new Error(`Could not extract ID from: ${csvUrl}`);
        console.log(`Spreadsheet ID: ${spreadsheetId}`);

        // 1. List All Sheets (Tabs)
        console.log('\n--- 1. Listing Sheet Tabs ---');
        const meta = await sheets.spreadsheets.get({ spreadsheetId });

        if (!meta.data.sheets) {
            console.log('No sheets found in metadata!');
            return;
        }

        meta.data.sheets.forEach((s, i) => {
            console.log(`[${i}] Title: "${s.properties?.title}", ID: ${s.properties?.sheetId}`);
        });

        // 2. Try to read data from the FIRST sheet
        const firstSheetName = meta.data.sheets[0].properties?.title;
        console.log(`\n--- 2. Reading Data from First Sheet: "${firstSheetName}" ---`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${firstSheetName}!A1:Z10`, // Read top 10 rows
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('Result: EMPTY (No data found in A1:Z10)');
        } else {
            console.log(`Result: Found ${rows.length} rows.`);
            rows.forEach((row, i) => {
                console.log(`Row ${i}:`, JSON.stringify(row));
                if (row.some(c => c.includes('合約編號'))) {
                    console.log('  -> MATCH: Found "合約編號" in this row!');
                }
            });
        }

    } catch (error) {
        console.error('DEBUG FAILED:', error);
    }
}

debugSecureSheet();
