import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

export async function GET() {
    const check = (key: string) => {
        const val = process.env[key];
        if (!val) return '❌ 未設定';
        if (key.includes('KEY') || key.includes('PASS') || key.includes('SECRET')) {
            return `✅ 已設定 (${val.length} 字元)`;
        }
        return `✅ ${val.substring(0, 40)}${val.length > 40 ? '...' : ''}`;
    };

    // 直接測試 Google Sheets API
    let sheetsTest = '';
    try {
        const cleanEmail = (process.env.GOOGLE_CLIENT_EMAIL || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();
        const cleanKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
        const client = new JWT({
            email: cleanEmail,
            key: cleanKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth: client });
        const csvUrl = process.env.SHEET_CSV_URL || '';
        const match = csvUrl.match(/\/d\/(.*?)(\/|$)/);
        const spreadsheetId = match ? match[1] : null;

        if (!spreadsheetId) {
            sheetsTest = '❌ 無法從 SHEET_CSV_URL 解析 spreadsheetId';
        } else {
            const meta = await sheets.spreadsheets.get({ spreadsheetId });
            const sheetCount = meta.data.sheets?.length ?? 0;
            sheetsTest = `✅ 成功連線，共 ${sheetCount} 個分頁`;
        }
    } catch (err: any) {
        sheetsTest = `❌ 失敗：${err.message}`;
    }

    return NextResponse.json({
        GOOGLE_CLIENT_EMAIL: check('GOOGLE_CLIENT_EMAIL'),
        GOOGLE_PRIVATE_KEY: check('GOOGLE_PRIVATE_KEY'),
        SHEET_CSV_URL: check('SHEET_CSV_URL'),
        TARGET_FOLDER_ID: check('TARGET_FOLDER_ID'),
        GEMINI_API_KEY: check('GEMINI_API_KEY'),
        SMTP_USER: check('SMTP_USER'),
        SMTP_PASS: check('SMTP_PASS'),
        SYSTEM_PASSWORD: check('SYSTEM_PASSWORD'),
        DATABASE_URL: check('DATABASE_URL'),
        sheets_connection_test: sheetsTest,
    });
}
