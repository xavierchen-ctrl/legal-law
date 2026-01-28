import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function debugSheet() {
    const url = process.env.SHEET_CSV_URL;
    console.log(`Fetching URL: ${url}`);

    if (!url) {
        console.error('URL is missing');
        return;
    }

    try {
        const res = await fetch(url);
        const text = await res.text();

        console.log('--- RESPONSE STATUS ---');
        console.log(res.status, res.statusText);

        console.log('--- RAW CONTENT START (First 500 chars) ---');
        console.log(text.substring(0, 500));
        console.log('--- RAW CONTENT END ---');

        const expectedHeader = '合約編號/取單號';
        if (text.includes(expectedHeader)) {
            console.log(`SUCCESS: Found header "${expectedHeader}"`);
        } else {
            console.error(`ERROR: Could not find header "${expectedHeader}"`);
        }

    } catch (err) {
        console.error('Fetch failed:', err);
    }
}

debugSheet();
