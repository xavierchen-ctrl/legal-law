
import 'dotenv/config';
import { scanAndNotify } from '../lib/scanner';

async function runManualScan() {
    console.log('🚀 Starting Manual Scan (Limit: 2)...');
    try {
        const result = await scanAndNotify({ limit: 2 });
        console.log('✅ Scan Complete:', result);
    } catch (error) {
        console.error('❌ Scan Failed:', error);
    }
}

runManualScan();
