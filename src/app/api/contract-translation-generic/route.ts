import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { translateGeneric, type GenericLangPair } from '@/lib/translation-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

const VALID_PAIRS: GenericLangPair[] = ['zh-ja', 'ja-zh', 'zh-zhs', 'zhs-zh', 'zh-vi', 'vi-zh'];

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { documentName, contractNumber, rawText, langPair } = body;

        if (!langPair || !VALID_PAIRS.includes(langPair)) {
            return NextResponse.json({ error: '無效的翻譯語言對' }, { status: 400 });
        }

        let textContent = '';

        if (rawText && rawText.trim().length > 0) {
            textContent = rawText.trim();
            if (textContent.length < 10) {
                return NextResponse.json({ error: '輸入文字過短，請提供完整的合約條款內容。' }, { status: 400 });
            }
        } else if (documentName) {
            const folderId = process.env.TARGET_FOLDER_ID;
            if (!folderId) return NextResponse.json({ error: 'TARGET_FOLDER_ID not set' }, { status: 500 });

            const files = await listFiles(folderId);
            const targetFile = findFileByDocumentName(files, documentName.trim(), contractNumber);
            if (!targetFile) {
                return NextResponse.json({ error: `找不到符合「${documentName}」的檔案。` }, { status: 404 });
            }

            const buffer = await downloadFile(targetFile.id);
            try {
                textContent = await extractTextFromPdf(buffer);
            } catch (e: any) {
                return NextResponse.json({ error: `PDF 解析失敗：${e.message}` }, { status: 500 });
            }

            if (!textContent || textContent.trim().length < 50) {
                return NextResponse.json({ error: '無法從 PDF 擷取足夠的文字內容。' }, { status: 422 });
            }
        } else {
            return NextResponse.json({ error: '請提供合約文字或文件名稱。' }, { status: 400 });
        }

        const result = await translateGeneric(textContent, langPair as GenericLangPair);
        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('[API /contract-translation-generic]', error);
        return NextResponse.json({ error: `翻譯失敗：${error.message ?? '未知錯誤'}` }, { status: 500 });
    }
}
