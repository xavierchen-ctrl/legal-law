import { scanAndNotify } from '../lib/scanner';
import 'dotenv/config';

async function runManualScan() {
    console.log('Initiating MANUAL FULL SCAN of ALL files...');
    try {
        const result = await scanAndNotify();
        console.log('\n========= SCAN RESULT =========');
        console.log(`Success: ${result.success}`);
        console.log(`Message: ${result.message}`);
        if (result.errors && result.errors.length > 0) {
            console.log('Errors encountered:');
            result.errors.forEach(e => console.log(`- ${e}`));
        }
        console.log('===============================');
        console.log('Check your email and the Google Sheet (Scan_History) for results!');
    } catch (error) {
        console.error('Manual scan failed with fatal error:', error);
    }
}

runManualScan();
