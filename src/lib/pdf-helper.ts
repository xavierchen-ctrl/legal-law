/**
 * Polyfill browser globals required by pdf-parse, then extract text from a PDF buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // pdf-parse uses browser canvas APIs internally — polyfill stubs for Node.js
    if (typeof (globalThis as any).DOMMatrix === 'undefined') {
        (globalThis as any).DOMMatrix = class DOMMatrix { constructor() {} };
    }
    if (typeof (globalThis as any).ImageData === 'undefined') {
        (globalThis as any).ImageData = class ImageData { constructor() {} };
    }
    if (typeof (globalThis as any).Path2D === 'undefined') {
        (globalThis as any).Path2D = class Path2D { constructor() {} };
    }

    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();  // returns { text, pages, total }
    return result?.text ?? '';
}
