import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    createdTime?: string;
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

export async function listFiles(folderId: string): Promise<DriveFile[]> {
    const drive = await getDriveClient();

    // Query: Inside folder, Not Trashed, Is PDF or Docx (Optional, currently PDF favored)
    // Adjust mimeType as needed: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
    const query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/pdf')`;

    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'createdTime desc', // Process newest first
        pageSize: 20 // Batch size
    });

    return (res.data.files as DriveFile[]) || [];
}

export async function downloadFile(fileId: string): Promise<Buffer> {
    const drive = await getDriveClient();

    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
    );

    return Buffer.from(res.data as ArrayBuffer);
}
