export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    return result?.text ?? '';
}
