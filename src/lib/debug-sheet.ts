import Papa from 'papaparse';

const SHEET_csv_URL = 'https://docs.google.com/spreadsheets/d/1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE/export?format=csv&gid=1607545574';

async function main() {
    console.log('Fetching from:', SHEET_csv_URL);
    try {
        const res = await fetch(SHEET_csv_URL);
        const text = await res.text();

        // Header logic from google-sheets.ts
        const headerStart = text.indexOf('合約編號/取單號');
        const cleanCsv = text.substring(headerStart);

        const result = Papa.parse(cleanCsv, {
            header: true,
            skipEmptyLines: true,
        });

        const data = result.data as any[];
        console.log(`Parsed ${data.length} rows.`);

        if (data.length > 0) {
            console.log('--- First Row Keys ---');
            Object.keys(data[0]).forEach(key => {
                console.log(`Key: "${key}"`); // Quote to see invisible chars
            });
            console.log('--- First Row Data ---');
            console.log(data[0]);
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
