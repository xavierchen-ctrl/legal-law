import { listFiles, downloadFile } from './drive-service';
import { getKeywords, getProcessedFileIds, logScanResult, KeywordRule } from './keyword-service';
import { sendNotificationEmail } from './email';
import { logSystemEvent } from './logger';

export async function scanAndNotify() {
    const folderId = process.env.TARGET_FOLDER_ID;
    if (!folderId) {
        throw new Error('TARGET_FOLDER_ID not set');
    }

    // 1. Prepare Data
    const [processedIds, rules] = await Promise.all([
        getProcessedFileIds(),
        getKeywords()
    ]);

    const activeRules = rules.filter(r => r.isActive);
    if (activeRules.length === 0) {
        console.log('No active keyword rules.');
        return { message: 'No active rules' };
    }

    // 2. Fetch Files
    const files = await listFiles(folderId);
    console.log(`Found ${files.length} files in folder.`);

    let processedCount = 0;
    let matchCount = 0;

    // Map<Email, List of Matched Items>
    const pendingNotifications = new Map<string, Array<{ fileName: string, link?: string, keywords: string[] }>>();

    // 3. Process Each File
    for (const file of files) {
        // Skip if already scanned
        if (processedIds.has(file.id)) {
            continue;
        }

        console.log(`Scanning new file: ${file.name} (${file.id})`);

        try {
            // Download & Extract Text
            const buffer = await downloadFile(file.id);
            // Dynamic import to avoid build-time bundling issues with canvas/dom
            // @ts-ignore
            const pdf = (await import('pdf-parse')).default; // or use require('pdf-parse') if ESM fails
            const data = await pdf(buffer);
            const content = data.text; // The raw text content

            // Check against rules
            const foundMatches: string[] = [];
            const emailsToSend = new Set<string>();

            for (const rule of activeRules) {
                if (content.includes(rule.keyword)) {
                    foundMatches.push(rule.keyword);
                    if (rule.targetEmail) {
                        // Support comma separated emails in rule
                        rule.targetEmail.split(',').forEach(e => emailsToSend.add(e.trim()));
                    }
                }
            }

            // Collect for Batch Notification (Do not send immediately)
            if (foundMatches.length > 0) {
                matchCount++;
                const item = {
                    fileName: file.name,
                    link: file.webViewLink,
                    keywords: foundMatches
                };

                emailsToSend.forEach(email => {
                    if (!pendingNotifications.has(email)) {
                        pendingNotifications.set(email, []);
                    }
                    pendingNotifications.get(email)!.push(item);
                });
            }

            // Log to History (Always log to prevent re-scanning, even if no match)
            await logScanResult(file.id, file.name, foundMatches);
            processedCount++;

        } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            await logSystemEvent('Scanner_Error', 'ERROR', `Failed ${file.name}: ${error}`);
        }
    }

    // 4. Send Batch Notifications
    for (const [email, items] of pendingNotifications) {
        const subject = `[每日掃描彙報] 發現 ${items.length} 個關注檔案`;

        const rows = items.map(item => `
            <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                <p style="margin: 5px 0;"><strong>檔案：</strong> ${item.fileName}</p>
                <p style="margin: 5px 0;"><strong>關鍵字：</strong> <span style="color: #d32f2f;">${item.keywords.join(', ')}</span></p>
                <p style="margin: 5px 0;">
                    <a href="${item.link}" target="_blank" style="color: #1a73e8; text-decoration: none;">開啟檔案 &rarr;</a>
                </p>
            </div>
        `).join('');

        const body = `
            <h3>文件掃描每日彙報</h3>
            <p>系統在今日掃描中，為您發現了以下 ${items.length} 個包含關注關鍵字的檔案：</p>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; border: 1px solid #ddd;">
                ${rows}
            </div>
            <p style="font-size: 12px; color: gray; margin-top: 20px;">
                此為每日自動掃描報告 (${new Date().toLocaleDateString()})
            </p>
        `;

        try {
            await sendNotificationEmail(email, subject, body);
            console.log(`Digest email sent to ${email} with ${items.length} items.`);
        } catch (err) {
            console.error(`Failed to send digest to ${email}`, err);
        }
    }

    // Log to History (Always log to prevent re-scanning, even if no match)
    await logScanResult(file.id, file.name, foundMatches);
    processedCount++;

} catch (error) {
    console.error(`Failed to process file ${file.name}:`, error);
    await logSystemEvent('Scanner_Error', 'ERROR', `Failed ${file.name}: ${error}`);
}
    }

const resultMsg = `Scanned ${processedCount} new files, found ${matchCount} matches.`;
await logSystemEvent('Drive_Scan', 'SUCCESS', resultMsg);
return { success: true, message: resultMsg };
}
