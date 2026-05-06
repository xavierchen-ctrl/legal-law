import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { generateContractReport } from '@/lib/report-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { rawText, documentName, contractNumber, reviewNotes = '', businessBackground = '' } = body;

        let contractText = '';

        if (rawText && rawText.trim().length > 0) {
            contractText = rawText.trim();
        } else if (documentName) {
            const folderId = process.env.TARGET_FOLDER_ID;
            if (!folderId) {
                return NextResponse.json({ error: 'TARGET_FOLDER_ID not set' }, { status: 500 });
            }

            const files = await listFiles(folderId);
            const cleanName = documentName.trim();

            const targetFile = findFileByDocumentName(files, cleanName, contractNumber);

            if (!targetFile) {
                return NextResponse.json(
                    { error: `找不到符合「${documentName}」的檔案。` },
                    { status: 404 }
                );
            }

            const buffer = await downloadFile(targetFile.id);
            try {
                contractText = await extractTextFromPdf(buffer);
            } catch (err: any) {
                return NextResponse.json({ error: `PDF 解析失敗：${err.message}` }, { status: 500 });
            }
        } else {
            return NextResponse.json({ error: '請提供合約文字或文件名稱。' }, { status: 400 });
        }

        if (contractText.trim().length < 20) {
            return NextResponse.json({ error: '合約內容過短。' }, { status: 400 });
        }

        const result = await generateContractReport(contractText, reviewNotes, businessBackground);
        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('[contract-report] Error:', error);
        return NextResponse.json({ error: `報告產出失敗：${error.message ?? '未知錯誤'}` }, { status: 500 });
    }
}
