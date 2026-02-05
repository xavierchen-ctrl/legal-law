
import { parse, isValid } from 'date-fns';

/**
 * Tries to parse a date string from Google Sheets which might be in various formats.
 * Supported formats: YYYY/MM/DD, MM/DD/YYYY, YYYY-MM-DD
 * @param dateStr The date string from the sheet
 * @returns Date object or null if invalid
 */
export function parseSheetDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return null;

    const cleanStr = dateStr.trim();

    // 1. Try ISO-like YYYY/MM/DD or YYYY-MM-DD
    // Check if it starts with 4 digits
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(cleanStr)) {
        const d = new Date(cleanStr);
        if (isValid(d)) return d;
    }

    // 2. Try date-fns parse for specific formats
    // Common format in Sheets is often M/d/yyyy or yyyy/M/d
    const formats = [
        'yyyy/M/d',
        'M/d/yyyy',
        'd/M/yyyy',
        'yyyy-M-d',
    ];

    for (const fmt of formats) {
        const d = parse(cleanStr, fmt, new Date());
        if (isValid(d)) return d;
    }

    // 3. Last fallback to JS Date (though risky)
    const fallback = new Date(cleanStr);
    return isValid(fallback) ? fallback : null;
}
