export async function register() {
    // Polyfill browser globals required by pdf-parse in Node.js environment
    if (typeof (globalThis as any).DOMMatrix === 'undefined') {
        (globalThis as any).DOMMatrix = class DOMMatrix { constructor() {} };
    }
    if (typeof (globalThis as any).ImageData === 'undefined') {
        (globalThis as any).ImageData = class ImageData { constructor() {} };
    }
    if (typeof (globalThis as any).Path2D === 'undefined') {
        (globalThis as any).Path2D = class Path2D { constructor() {} };
    }
}
