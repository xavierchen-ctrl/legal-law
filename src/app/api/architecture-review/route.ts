import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { analyzeContractArchitecture } from '@/lib/ai-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

// NOTE: pdf-parse uses CommonJS and has issues with Next.js static imports.
// We intentionally use dynamic require() inside the handler to avoid module init crashes.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber } = body;

        if (!documentName) {
            return NextResponse.json({ error: 'Missing documentName in request' }, { status: 400 });
        }

        // ── 1. Find the PDF file on Google Drive ────────────────────────────
        const folderId = process.env.TARGET_FOLDER_ID;
        if (!folderId) {
            return NextResponse.json(
                { error: 'Server configuration error: TARGET_FOLDER_ID not set' },
                { status: 500 }
            );
        }

        console.log(`[ArchReview] Searching Drive for: ${documentName} | folderId: ${folderId}`);
        let files: Awaited<ReturnType<typeof listFiles>> = [];
        try {
            files = await listFiles(folderId);
            console.log(`[ArchReview] Files in Drive (${files.length}):`, files.map(f => f.name).join(' | '));
        } catch (driveErr: any) {
            console.error('[ArchReview] Drive listFiles error:', driveErr?.message ?? driveErr);
            return NextResponse.json({ error: `Google Drive 連線失敗：${driveErr?.message ?? '未知錯誤'}` }, { status: 500 });
        }

        const targetFile = findFileByDocumentName(files, documentName, contractNumber);

        if (!targetFile) {
            return NextResponse.json(
                { error: `在 Google Drive 資料夾中找不到符合「${documentName}」的檔案。請確認該合約 PDF 是否已上傳至目標資料夾，且檔名與合約名稱相符。` },
                { status: 404 }
            );
        }

        console.log(`[ArchReview] Found file: ${targetFile.name} (${targetFile.id})`);

        // ── 2. Download & Parse PDF ─────────────────────────────────────────
        const buffer = await downloadFile(targetFile.id);

        let textContent = '';
        try {
            textContent = await extractTextFromPdf(buffer);
        } catch (pdfErr: any) {
            console.error('[ArchReview] PDF parse error:', pdfErr);
            return NextResponse.json(
                { error: `PDF 解析失敗：${pdfErr.message ?? '未知錯誤'}` },
                { status: 500 }
            );
        }

        if (!textContent || textContent.trim().length < 50) {
            return NextResponse.json(
                { error: '無法從 PDF 擷取足夠的文字內容（可能是掃描圖片型 PDF）。架構檢視需要可解析的文字內容。' },
                { status: 422 }
            );
        }

        console.log(`[ArchReview] Extracted ${textContent.length} chars. Running AI analysis...`);

        // ── 3. Analyze via Gemini AI ────────────────────────────────────────
        const results = await analyzeContractArchitecture(textContent);

        return NextResponse.json({
            success: true,
            fileId: targetFile.id,
            fileName: targetFile.name,
            charCount: textContent.length,
            results,
        });

    } catch (error: any) {
        console.error('[API /architecture-review] Unhandled error:', error);
        return NextResponse.json(
            { error: `執行架構檢視失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
