import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    createdTime?: string;
    webViewLink?: string;
    folderName?: string; // name of the immediate parent Drive folder
}

// In-memory cache: folderId → { files, expiresAt }
const fileListCache = new Map<string, { files: DriveFile[]; expiresAt: number }>();
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

async function getDriveClient() {
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing Google Credentials');
    }

    const client = new JWT({
        email: (process.env.GOOGLE_CLIENT_EMAIL || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim(),
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim(),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    return google.drive({ version: 'v3', auth: client });
}

async function listSubfolders(drive: any, folderId: string): Promise<DriveFile[]> {
    const results: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
        const res: any = await drive.files.list({
            q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'nextPageToken, files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives',
            pageSize: 1000,
            ...(pageToken ? { pageToken } : {}),
        });
        results.push(...((res.data.files as DriveFile[]) || []));
        pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return results;
}

async function listAllPdfsRecursive(folderId: string, folderName?: string, depth = 0): Promise<DriveFile[]> {
    const drive = await getDriveClient();

    const [pdfRes, subfolders] = await Promise.all([
        drive.files.list({
            q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
            fields: 'files(id, name, mimeType, createdTime, webViewLink)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives',
            pageSize: 1000,
        }),
        listSubfolders(drive, folderId),
    ]);

    const pdfs = ((pdfRes.data.files as DriveFile[]) || []).map(f => ({
        ...f,
        folderName: folderName ?? '',
    }));

    if (depth <= 2) {
        console.log(`[Drive] depth=${depth} folder="${folderName ?? 'ROOT'}" → ${pdfs.length} PDFs, ${subfolders.length} subfolders`);
    }

    const nested = await Promise.all(subfolders.map(f => listAllPdfsRecursive(f.id, f.name, depth + 1)));
    return [...pdfs, ...nested.flat()];
}

export async function listFiles(folderId: string): Promise<DriveFile[]> {
    const cached = fileListCache.get(folderId);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Drive] Cache hit for folder ${folderId} (${cached.files.length} files)`);
        return cached.files;
    }

    console.log(`[Drive] Cache miss — scanning folder ${folderId}...`);
    const files = await listAllPdfsRecursive(folderId);
    fileListCache.set(folderId, { files, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(`[Drive] Scan complete: ${files.length} files cached for 8 min`);
    return files;
}

/**
 * 在 Drive 檔案清單中依文件名稱（及合約編號）找出最佳符合檔案
 *
 * 比對策略優先順序：
 *   0. 合約編號對應子資料夾（folderName 含合約編號）→ 取最新一筆 PDF
 *   1. 精確 / 去副檔名 / 包含比對
 *   2. 中文關鍵字得分比對
 */
export function findFileByDocumentName(
    files: DriveFile[],
    documentName: string,
    contractNumber?: string,
): DriveFile | null {

    // 策略 0：依合約編號找子資料夾
    if (contractNumber) {
        const segments = contractNumber.split('/').map(s => s.trim()).filter(Boolean);
        console.log(`[Drive] findFile: contractNumber="${contractNumber}", segments=${JSON.stringify(segments)}, totalFiles=${files.length}`);

        // Sample first few folderNames for diagnosis
        const sampleFolders = [...new Set(files.map(f => f.folderName).filter(Boolean))].slice(0, 20);
        console.log(`[Drive] Unique folderNames (sample):`, sampleFolders.join(' | '));

        for (const seg of segments) {
            const inFolder = files.filter(f =>
                f.folderName && (
                    f.folderName === seg ||
                    f.folderName.includes(seg) ||
                    seg.includes(f.folderName)
                )
            );
            console.log(`[Drive] Folder "${seg}": ${inFolder.length} PDF(s) found`);
            if (inFolder.length === 1) {
                console.log(`[Drive] Folder match: ${seg} → ${inFolder[0].name}`);
                return inFolder[0];
            }
            if (inFolder.length > 1) {
                const best = pickBestByName(inFolder, documentName);
                console.log(`[Drive] Folder match (multi): ${seg} → ${best?.name}`);
                return best ?? inFolder[0];
            }
        }
    }

    // 策略 1 & 2：依文件名稱比對（全域）
    return pickBestByName(files, documentName);
}

function pickBestByName(files: DriveFile[], documentName: string): DriveFile | null {
    const clean = documentName.trim();
    const lower = clean.toLowerCase();

    const direct =
        files.find(f => f.name === clean) ||
        files.find(f => f.name === `${clean}.pdf`) ||
        files.find(f => f.name.replace(/\.pdf$/i, '') === clean) ||
        files.find(f => f.name.toLowerCase().includes(lower));
    if (direct) return direct;

    const keywords = clean.match(/[一-龥]{3,}/g) ?? [];
    if (keywords.length === 0) return null;

    const scored = files
        .map(f => ({
            f,
            score: keywords.filter(kw => f.name.toLowerCase().includes(kw.toLowerCase())).length,
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].f : null;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
    const drive = await getDriveClient();

    const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
    );

    return Buffer.from(res.data as ArrayBuffer);
}
