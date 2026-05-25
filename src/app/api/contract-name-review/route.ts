import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { reviewContractNameAndPreamble } from '@/lib/ai-service';
import type { NamePreambleCaseContext } from '@/lib/ai-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber, rawText, caseContext } = body as {
            documentName?: string; contractNumber?: string; rawText?: string;
            caseContext?: NamePreambleCaseContext;
        };

        let textContent = '';

        if (rawText && rawText.trim().length > 0) {
            textContent = rawText.trim();
            if (textContent.length < 20) {
                return NextResponse.json(
                    { error: '輸入文字過短，請提供完整的合約內容（至少20字元）。' },
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
        } else {
            return NextResponse.json(
                { error: '請提供合約文字（rawText）或文件名稱（documentName）。' },
                { status: 400 }
            );
        }

        console.log(`[NameReview] Text length: ${textContent.length} chars`);
        const result = await reviewContractNameAndPreamble(textContent, caseContext);

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('[API /contract-name-review] Error:', error);
        return NextResponse.json(
            { error: `審閱失敗：${error.message ?? '未知錯誤'}` },
            { status: 500 }
        );
    }
}
