
import 'dotenv/config';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

async function clearHistory() {
    console.log('🧹 Clearing Scan History...');

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.SHEET_CSV_URL) {
        throw new Error('Missing Env Config');
    }

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: client });

    const match = process.env.SHEET_CSV_URL.match(/\/d\/(.*?)(\/|$)/);
    const spreadsheetId = match ? match[1] : null;

    if (!spreadsheetId) throw new Error('Invalid Sheet URL');

    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'Scan_History!A2:Z', // Clear everything after header
    });

    console.log('✅ History Cleared. All files will be treated as new.');
}

clearHistory();
