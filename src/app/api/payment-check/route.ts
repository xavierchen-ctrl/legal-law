import { NextResponse } from 'next/server';
import { listFiles, downloadFile, findFileByDocumentName } from '@/lib/drive-service';
import { analyzePaymentTerms, OurRole } from '@/lib/payment-service';
import { extractTextFromPdf } from '@/lib/pdf-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            rawText,
            documentName,
            contractNumber,
            historicalTerms = '',
            companyPolicy = '',
            transactionBackground = '',
            counterpartyType = 'new',
            ourRole = 'AUTO',
        } = body;

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

        const validRoles: OurRole[] = ['COLLECTOR', 'PAYER', 'AUTO'];
        const resolvedOurRole: OurRole = validRoles.includes(ourRole as OurRole) ? (ourRole as OurRole) : 'AUTO';

        const result = await analyzePaymentTerms(
            contractText,
            historicalTerms,
            companyPolicy,
            transactionBackground,
            counterpartyType,
            resolvedOurRole
        );

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('[payment-check] Error:', error);
        return NextResponse.json({ error: `分析失敗：${error.message ?? '未知錯誤'}` }, { status: 500 });
    }
}
