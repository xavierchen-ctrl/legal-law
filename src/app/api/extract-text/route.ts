import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

async function extractDocx(buffer: Buffer): Promise<string> {
    const id = randomUUID();
    const tmpBase = join(tmpdir(), `docx_${id}`);
    const zipPath = `${tmpBase}.zip`;   // Expand-Archive only accepts .zip
    const extractDir = `${tmpBase}_extracted`;

    try {
        writeFileSync(zipPath, buffer);
        mkdirSync(extractDir, { recursive: true });

        execSync(
            `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
            { timeout: 15000 }
        );

        const xmlPath = join(extractDir, 'word', 'document.xml');
        const xml = readFileSync(xmlPath, 'utf8');

        // Extract text from <w:t> elements, preserve paragraph breaks
        const text = xml
            .replace(/<w:p[ >]/g, '\n<w:p ')
            .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return text;
    } finally {
        try { rmSync(zipPath, { force: true }); } catch {}
        try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: '請上傳檔案。' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());
        let text = '';

        if (fileName.endsWith('.txt')) {
            text = buffer.toString('utf8');

        } else if (fileName.endsWith('.pdf')) {
            text = await extractTextFromPdf(buffer);

            if (text.trim().length < 20) {
                return NextResponse.json(
                    { error: '無法從 PDF 擷取文字（可能為掃描圖片型 PDF）。' },
                    { status: 422 }
                );
            }

        } else if (fileName.endsWith('.docx')) {
            text = await extractDocx(buffer);

        } else {
            return NextResponse.json(
                { error: '不支援的檔案格式。請上傳 PDF、DOCX 或 TXT 檔案。' },
                { status: 400 }
            );
        }

        if (!text || text.trim().length < 10) {
            return NextResponse.json({ error: '擷取到的文字內容過短，請確認檔案內容。' }, { status: 422 });
        }

        return NextResponse.json({ success: true, text: text.trim(), charCount: text.trim().length });

    } catch (error: any) {
        console.error('[extract-text] Error:', error);
        return NextResponse.json(
            { error: `檔案解析失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
