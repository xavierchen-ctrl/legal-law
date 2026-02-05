import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    createdTime?: string;
    webViewLink?: string;
}

// Reuse Auth logic (Should ideally be a shared helper, but keeping isolated for safety)
async function getDriveClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    return google.drive({ version: 'v3', auth: client });
}

// Helper to list immediate children (files or folders)
async function listChildren(folderId: string, mimeTypeFilter?: string): Promise<DriveFile[]> {
    const drive = await getDriveClient();
    let query = `'${folderId}' in parents and trashed = false`;
    if (mimeTypeFilter) {
        query += ` and ${mimeTypeFilter}`;
    }

    // Handle large folders with pagination if needed, but keeping simple for now
    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
        orderBy: 'createdTime desc',
        pageSize: 100 // Check more files per request
    });

    return (res.data.files as DriveFile[]) || [];
}

export async function listFiles(folderId: string): Promise<DriveFile[]> {
    // 1. Get all PDF files in current folder
    const files = await listChildren(folderId, "(mimeType = 'application/pdf')");

    // 2. Get all subfolders
    const subfolders = await listChildren(folderId, "(mimeType = 'application/vnd.google-apps.folder')");

    // 3. Recursively scan subfolders
    const subfolderPromises = subfolders.map(folder => listFiles(folder.id));
    const nestedFiles = await Promise.all(subfolderPromises);

    // 4. Flatten and return
    return [...files, ...nestedFiles.flat()];
}

export async function downloadFile(fileId: string): Promise<Buffer> {
    const drive = await getDriveClient();

    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
    );

    return Buffer.from(res.data as ArrayBuffer);
}
