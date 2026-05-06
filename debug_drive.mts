// Temporary debug script to list all files in Google Drive target folder
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Need to import after env is loaded
async function main() {
    const { listFiles } = await import('./src/lib/drive-service');
    
    const folderId = process.env.TARGET_FOLDER_ID;
    console.log('TARGET_FOLDER_ID:', folderId);
    
    if (!folderId) {
        console.error('TARGET_FOLDER_ID not set!');
        process.exit(1);
    }
    
    const files = await listFiles(folderId);
    console.log(`\nFound ${files.length} files in Drive:\n`);
    files.forEach((f, i) => {
        console.log(`  ${i+1}. "${f.name}" (${f.mimeType})`);
    });
}

main().catch(console.error);
