import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { translateContractText } from '@/lib/translation-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber, rawText } = body;

        let textContent = '';
        let sourceInfo = { fileName: '', fileId: '', charCount: 0, source: '' };

        // ── Mode 1: Direct text input ────────────────────────────────────────
        if (rawText && rawText.trim().length > 0) {
            textContent = rawText.trim();
            sourceInfo.source = 'text';
            sourceInfo.charCount = textContent.length;

            if (textContent.length < 20) {
                return NextResponse.json(
                    { error: '輸入文字過短，請提供完整的合約條款內容（至少20字元）。' },
                    { status: 400 }
                );
            }
        }
        // ── Mode 2: Load PDF from Google Drive ───────────────────────────────
        else if (documentName) {
            const folderId = process.env.TARGET_FOLDER_ID;
            if (!folderId) {
                return NextResponse.json(
                    { error: 'Server configuration error: TARGET_FOLDER_ID not set' },
                    { status: 500 }
                );
            }

            console.log(`[Translation] Searching Drive for: ${documentName}`);
            const files = await listFiles(folderId);

            const cleanName = documentName.trim();

            const targetFile = findFileByDocumentName(files, cleanName, contractNumber);

            if (!targetFile) {
                return NextResponse.json(
                    {
                        error: `在 Google Drive 資料夾中找不到符合「${documentName}」的檔案。\n請確認該合約 PDF 是否已上傳至目標資料夾，且檔名與合約名稱相符。`,
                    },
                    { status: 404 }
                );
            }

            const buffer = await downloadFile(targetFile.id);

            try {
                textContent = await extractTextFromPdf(buffer);
            } catch (pdfErr: any) {
                return NextResponse.json(
                    { error: `PDF 解析失敗：${pdfErr.message ?? '未知錯誤'}` },
                    { status: 500 }
                );
            }

            if (!textContent || textContent.trim().length < 50) {
                return NextResponse.json(
                    { error: '無法從 PDF 擷取足夠的文字內容（可能是掃描圖片型 PDF）。翻譯功能需要可解析的文字內容。' },
                    { status: 422 }
                );
            }

            sourceInfo = {
                fileName: targetFile.name,
                fileId: targetFile.id,
                charCount: textContent.length,
                source: 'drive',
            };
        } else {
            return NextResponse.json(
                { error: '請提供合約文字（rawText）或文件名稱（documentName）。' },
                { status: 400 }
            );
        }

        console.log(`[Translation] Text length: ${textContent.length} chars. Running translation...`);

        const result = await translateContractText(textContent);

        return NextResponse.json({
            success: true,
            ...sourceInfo,
            result,
        });

    } catch (error: any) {
        console.error('[API /contract-translation] Unhandled error:', error);
        return NextResponse.json(
            { error: `翻譯失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
