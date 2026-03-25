import { listFiles } from '../lib/drive-service';
import 'dotenv/config';

async function testDriveAccess() {
    const folderId = process.env.TARGET_FOLDER_ID;
    console.log(`Testing access to Folder ID: ${folderId}`);
    
    if (!folderId) {
        console.error('TARGET_FOLDER_ID is not set in .env');
        return;
    }

    try {
        const files = await listFiles(folderId);
        console.log(`\n✅ Success! Successfully accessed the folder.`);
        console.log(`Total PDF files found: ${files.length}\n`);
        
        if (files.length > 0) {
            console.log('--- File List (Top 5) ---');
            files.slice(0, 5).forEach((f, i) => {
                console.log(`${i + 1}. [${f.id}] ${f.name}`);
            });
            if (files.length > 5) {
                console.log(`... and ${files.length - 5} more files.`);
            }
        } else {
            console.log('The folder is currently empty or contains no PDF files.');
        }
    } catch (error: any) {
        console.error(`\n❌ Failed to access Google Drive:`, error.message);
        console.error(`Please ensure the Service Account email (${process.env.GOOGLE_CLIENT_EMAIL}) has "Viewer" permission to this folder.`);
    }
}

testDriveAccess();
