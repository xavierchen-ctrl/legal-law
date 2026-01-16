import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Extract Sheet ID from the CSV URL or use a dedicated ENV
const SPREADSHEET_ID = '1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuth() {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    // Handle private key newlines for Vercel/Env compatibility
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !key) {
        console.error('Missing Google Service Account Credentials');
        return null;
    }

    return new JWT({
        email,
        key,
        scopes: SCOPES,
    });
}

export type LogStatus = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export async function logSystemEvent(
    action: string,
    status: LogStatus,
    message: string
) {
    try {
        const auth = getAuth();
        if (!auth) return;

        const sheets = google.sheets({ version: 'v4', auth });
        const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

        // Ensure "System_Logs" sheet exists (basic check, can be skipped for performance if we assume it exists)
        // For robustness, we just try to append. If it fails, we might need to create it manually once.

        const resource = {
            values: [[timestamp, action, status, message]],
        };

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'System_Logs!A:D',
            valueInputOption: 'USER_ENTERED',
            requestBody: resource,
        });

        console.log(`[Logger] Logged to Sheet: ${action} - ${status}`);
    } catch (error) {
        // Fallback: don't crash the app if logging fails
        console.error('[Logger] Failed to write log:', error);
    }
}

export interface SystemLog {
    timestamp: string;
    action: string;
    status: string;
    message: string;
}

export async function getSystemLogs(limit = 50): Promise<SystemLog[]> {
    try {
        const auth = getAuth();
        if (!auth) return [];

        const sheets = google.sheets({ version: 'v4', auth });

        // Read from System_Logs
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `System_Logs!A:D`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        // Assuming Row 1 is header, logs start from Row 2.
        // We want the LATEST logs (bottom of sheet), essentially.
        // Let's reverse the array to show newest first
        const logs = rows.slice(1).reverse().slice(0, limit).map(row => ({
            timestamp: row[0] || '',
            action: row[1] || '',
            status: row[2] || '',
            message: row[3] || '',
        }));

        return logs;
    } catch (error) {
        console.error('[Logger] Failed to read logs:', error);
        return [];
    }
}
