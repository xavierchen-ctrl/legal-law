import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

export async function GET() {
    const status: any = {
        timestamp: new Date().toISOString(),
        env_check: {},
        key_diagnosis: {},
        connection_test: {}
    };

    // 1. Check Env Vars existence (Redacted)
    status.env_check = {
        SHEET_CSV_URL_SET: !!process.env.SHEET_CSV_URL,
        TARGET_FOLDER_ID_SET: !!process.env.TARGET_FOLDER_ID,
        GOOGLE_CLIENT_EMAIL_SET: !!process.env.GOOGLE_CLIENT_EMAIL,
        GOOGLE_PRIVATE_KEY_SET: !!process.env.GOOGLE_PRIVATE_KEY,
    };

    // 2. Check Key Format
    const key = process.env.GOOGLE_PRIVATE_KEY || '';
    status.key_diagnosis = {
        total_length: key.length,
        starts_with_dash: key.trim().startsWith('-----BEGIN PRIVATE KEY'),
        contains_literal_newline: key.includes('\\n'), // Usually true in Vercel UI
        contains_real_newline: key.includes('\n'),
    };

    // Logic used in app:
    const fixedKey = key.replace(/\\n/g, '\n');

    // 3. Try Connection
    try {
        if (!process.env.GOOGLE_CLIENT_EMAIL || !fixedKey) throw new Error('Missing Credentials');

        const client = new JWT({
            email: process.env.GOOGLE_CLIENT_EMAIL,
            key: fixedKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        // Test Authentication
        await client.authorize();
        status.connection_test.auth = 'SUCCESS';

        const sheets = google.sheets({ version: 'v4', auth: client });

        // Extract ID
        const csvUrl = process.env.SHEET_CSV_URL || '';
        const match = csvUrl.match(/\/d\/(.*?)(\/|$)/);
        const spreadsheetId = match ? match[1] : 'INVALID_URL';

        status.connection_test.spreadsheetId = spreadsheetId;

        if (spreadsheetId === 'INVALID_URL') throw new Error('Could not parse Spreadsheet ID from URL');

        // Try fetch Metadata
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        status.connection_test.sheet_access = 'SUCCESS';
        status.connection_test.sheet_title = meta.data.properties?.title;

        // Try Read Data
        const sheetName = meta.data.sheets?.[0].properties?.title;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:E1`,
        });
        status.connection_test.data_read = 'SUCCESS';
        status.connection_test.first_row = response.data.values?.[0] || 'EMPTY';

    } catch (error: any) {
        status.connection_test.status = 'FAILED';
        status.connection_test.error_message = error.message;
        // status.connection_test.raw_error = JSON.stringify(error);
    }

    return NextResponse.json(status, { status: 200 });
}
