import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { translateChineseToEnglish } from '@/lib/translation-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber, rawText } = body;

        let textContent = '';
        let sourceInfo = { fileName: '', fileId: '', charCount: 0, source: '' };

        if (rawText && rawText.trim().length > 0) {
            textContent = rawText.trim();
            sourceInfo.source = 'text';
            sourceInfo.charCount = textContent.length;

            if (textContent.length < 10) {
                return NextResponse.json(
                    { error: '輸入文字過短，請提供完整的合約條款內容（至少10字元）。' },
                    { status: 400 }
                );
            }
        } else if (documentName) {
            const folderId = process.env.TARGET_FOLDER_ID;
            if (!folderId) {
                return NextResponse.json(
                    { error: 'Server configuration error: TARGET_FOLDER_ID not set' },
                    { status: 500 }
                );
            }

            const files = await listFiles(folderId);
            const cleanName = documentName.trim();

            const targetFile = findFileByDocumentName(files, cleanName, contractNumber);

            if (!targetFile) {
                return NextResponse.json(
                    { error: `在 Google Drive 資料夾中找不到符合「${documentName}」的檔案。` },
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
                    { error: '無法從 PDF 擷取足夠的文字內容（可能是掃描圖片型 PDF）。' },
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

        console.log(`[ZH→EN Translation] Text length: ${textContent.length} chars`);
        const result = await translateChineseToEnglish(textContent);

        return NextResponse.json({ success: true, ...sourceInfo, result });

    } catch (error: any) {
        console.error('[API /contract-translation-cten] Unhandled error:', error);
        return NextResponse.json(
            { error: `翻譯失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
