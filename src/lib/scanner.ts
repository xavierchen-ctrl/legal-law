const pdf = require('pdf-parse');
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

            // Action: Notification
            if (foundMatches.length > 0) {
                matchCount++;
                const subject = `[Legal Alert] 發現關鍵字: ${file.name}`;
                const body = `
                    <h3>文件掃描通知</h3>
                    <p>在檔案 <strong>${file.name}</strong> 中發現關注的關鍵字。</p>
                    <ul>
                        ${foundMatches.map(k => `<li>${k}</li>`).join('')}
                    </ul>
                    <p>請前往 Google Drive 查看詳細內容。</p>
                `;

                const recipients = Array.from(emailsToSend);
                if (recipients.length > 0) {
                    await sendNotificationEmail(recipients.join(','), subject, body);
                    console.log(`Email sent to ${recipients.length} recipients.`);
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
