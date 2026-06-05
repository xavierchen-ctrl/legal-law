import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { analyzeContractArchitecture, analyzeContractArchitectureMulti, DocumentInput } from '@/lib/ai-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber, contractText, documents } = body;

        // Mode A: Multi-document suite
        if (documents && Array.isArray(documents) && documents.length > 0) {
            const validDocs: DocumentInput[] = documents.filter(
                (d: any) => d.label && typeof d.text === 'string' && d.text.trim().length >= 30
            );
            if (validDocs.length === 0) {
                return NextResponse.json({ error: '所有文件內容均過短，無法分析。' }, { status: 400 });
            }
            const results = await analyzeContractArchitectureMulti(validDocs);
            return NextResponse.json({
                success: true,
                mode: 'suite',
                analyzedDocuments: validDocs.map(d => ({ label: d.label, version: d.version ?? null, charCount: d.text.length })),
                results,
            });
        }

        // Mode B: Single text (manual paste)
        if (contractText) {
            if (contractText.trim().length < 50) {
                return NextResponse.json({ error: '合約文字內容不足，無法進行分析。' }, { status: 400 });
            }
            const results = await analyzeContractArchitecture(contractText);
            return NextResponse.json({
                success: true,
                mode: 'text',
                fileName: '（手動貼上）',
                charCount: contractText.length,
                results,
            });
        }

        // Mode C: Google Drive auto-search
        if (!documentName) {
            return NextResponse.json({ error: 'Missing documentName, contractText, or documents in request' }, { status: 400 });
        }

        const folderId = process.env.TARGET_FOLDER_ID;
        if (!folderId) {
            return NextResponse.json({ error: 'Server configuration error: TARGET_FOLDER_ID not set' }, { status: 500 });
        }

        console.log(`[ArchReview] Searching Drive for: ${documentName} | folderId: ${folderId}`);
        let files: Awaited<ReturnType<typeof listFiles>> = [];
        try {
            files = await listFiles(folderId);
        } catch (driveErr: any) {
            return NextResponse.json({ error: `Google Drive 連線失敗：${driveErr?.message ?? '未知錯誤'}` }, { status: 500 });
        }

        const targetFile = findFileByDocumentName(files, documentName, contractNumber);
        if (!targetFile) {
            return NextResponse.json(
                { error: `在 Google Drive 資料夾中找不到符合「${documentName}」的檔案。請確認該合約 PDF 是否已上傳至目標資料夾，或改用「文件套件」模式手動上傳。` },
                { status: 404 }
            );
        }

        console.log(`[ArchReview] Found file: ${targetFile.name} (${targetFile.id})`);
        const buffer = await downloadFile(targetFile.id);

        let textContent = '';
        try {
            textContent = await extractTextFromPdf(buffer);
        } catch (pdfErr: any) {
            return NextResponse.json({ error: `PDF 解析失敗：${pdfErr.message ?? '未知錯誤'}` }, { status: 500 });
        }

        if (!textContent || textContent.trim().length < 50) {
            return NextResponse.json(
                { error: '無法從 PDF 擷取足夠的文字內容（可能是掃描圖片型 PDF）。請改用「文件套件」模式手動上傳。' },
                { status: 422 }
            );
        }

        const results = await analyzeContractArchitecture(textContent);
        return NextResponse.json({
            success: true,
            mode: 'drive',
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
