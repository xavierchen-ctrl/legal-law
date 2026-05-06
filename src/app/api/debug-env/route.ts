import { NextResponse } from 'next/server';

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
    });
}
