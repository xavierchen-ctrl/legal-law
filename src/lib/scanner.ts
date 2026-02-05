import { listFiles, downloadFile } from './drive-service';
import { getKeywords, getProcessedFileIds, logScanResult, KeywordRule } from './keyword-service';
import { getAIRules } from './ai-rule-service';
import { analyzeContractWithAI, AIAnalysisResult } from './ai-service';
import { sendNotificationEmail } from './email';
import { logSystemEvent } from './logger';
// @ts-ignore
import { PDFParse } from 'pdf-parse';

interface NotificationItem {
    fileName: string;
    link: string;
    keywords: string[];
    aiFindings: { rule: string, reason: string, risk: string }[];
}

export async function scanAndNotify(options: { limit?: number; apiKey?: string } = {}) {
    const { limit, apiKey } = options;
    const folderId = process.env.TARGET_FOLDER_ID;
    if (!folderId) {
        throw new Error('TARGET_FOLDER_ID not set');
    }

    await logSystemEvent('Scanner', 'INFO', 'Starting drive scan...');

    try {
        // 1. Prepare Data
        const [processedIds, rules, aiRules] = await Promise.all([
            getProcessedFileIds(),
            getKeywords(),
            getAIRules().catch(e => [])
        ]);

        const activeKeywords = rules.filter(r => r.isActive);
        const activeAIRules = aiRules.filter(r => r.isActive);

        if (activeKeywords.length === 0 && activeAIRules.length === 0) {
            console.log('No active keywords or AI rules defined.');
            return { success: true, message: 'No active rules' };
        }

        // 2. List Files from Drive
        // Use the folderId from env, NOT the limit number.
        const allFiles = await listFiles(folderId);
        const files = options.limit ? allFiles.slice(0, options.limit) : allFiles;

        console.log(`Found ${allFiles.length} files in Drive folder. Processing ${files.length}.`);

        const newFiles = files.filter(f => !processedIds.has(f.id));
        console.log(`Found ${newFiles.length} new files to process.`);

        if (newFiles.length === 0) {
            return { success: true, message: 'No new files found.' };
        }

        // 3. Process Each File
        const pendingNotifications = new Map<string, NotificationItem[]>();
        let processedCount = 0;
        let matchCount = 0;
        const errors: string[] = [];

        for (const file of newFiles) {
            console.log(`Processing file: ${file.name} (${file.id})...`);

            try {
                // Download & Extract Text
                const buffer = await downloadFile(file.id);
                // @ts-ignore
                const parser = new PDFParse({ data: buffer });
                const data = await parser.getText();
                const content = data.text;

                // --- A. Check Keywords ---
                const foundMatches: string[] = [];
                const emailsToSend = new Set<string>();

                for (const rule of activeKeywords) {
                    if (content.includes(rule.keyword)) {
                        foundMatches.push(rule.keyword);
                        if (rule.targetEmail) {
                            rule.targetEmail.split(',').forEach(e => emailsToSend.add(e.trim()));
                        }
                    }
                }

                // --- B. Check AI Rules ---
                const aiFindings: { rule: string, reason: string, risk: string }[] = [];
                if (activeAIRules.length > 0) {
                    console.log(`Running AI Analysis for ${file.name}...`);
                    // Pass apiKey to AI Service!
                    const analysisResults = await analyzeContractWithAI(content, activeAIRules, apiKey);

                    for (const result of analysisResults) {
                        if (result.violationFound) {
                            const ruleConfig = activeAIRules[result.ruleId];
                            if (ruleConfig) {
                                console.log(`⚠️ Violation: [${ruleConfig.ruleName}]`);
                                aiFindings.push({
                                    rule: ruleConfig.ruleName,
                                    reason: result.reasoning,
                                    risk: 'HIGH'
                                });
                                if (ruleConfig.targetEmail) {
                                    ruleConfig.targetEmail.split(',').forEach(e => emailsToSend.add(e.trim()));
                                }
                            }
                        }
                    }
                }

                // Collect Matches
                if (foundMatches.length > 0 || aiFindings.length > 0) {
                    matchCount++;
                    const item: NotificationItem = {
                        fileName: file.name,
                        link: file.webViewLink || '',
                        keywords: foundMatches,
                        aiFindings: aiFindings
                    };

                    emailsToSend.forEach(email => {
                        if (!pendingNotifications.has(email)) {
                            pendingNotifications.set(email, []);
                        }
                        pendingNotifications.get(email)!.push(item);
                    });
                }

                // Log Result
                const logContent = [...foundMatches, ...aiFindings.map(f => `[AI] ${f.rule}`)].slice(0, 10);
                await logScanResult(file.id, file.name, logContent, file.webViewLink || '');
                processedCount++;

            } catch (error: any) {
                console.error(`Failed to process file ${file.name}:`, error);
                await logSystemEvent('Scanner_Error', 'ERROR', `Failed ${file.name}: ${error.message}`);
                errors.push(`${file.name}: ${error.message || error}`);
            }

            // Rate Limit for AI
            if (activeAIRules.length > 0) {
                await new Promise(r => setTimeout(r, 20000));
            }
        }

        // 4. Send Notifications
        for (const [email, items] of pendingNotifications) {
            const isDev = process.env.NODE_ENV === 'development';
            const envTag = isDev ? '【測試站/Local】' : '【正式站/Cloud】';
            const subject = `${envTag} [每日掃描彙報] 發現 ${items.length} 個關注檔案`;
            const rows = items.map(item => {
                let detailsHtml = '';
                if (item.keywords.length > 0) detailsHtml += `<p><strong>關鍵字：</strong> <span style="color:red">${item.keywords.join(', ')}</span></p>`;
                if (item.aiFindings.length > 0) {
                    const aiRows = item.aiFindings.map(f => `<li><span style="background:#ffeba1">${f.rule}</span> ${f.reason}</li>`).join('');
                    detailsHtml += `<div style="background:#fff3e0;padding:10px;margin-top:10px"><strong>AI 風險：</strong><ul>${aiRows}</ul></div>`;
                }
                return `<div style="border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:20px"><p><strong>檔案：</strong> ${item.fileName}</p>${detailsHtml}<a href="${item.link}">開啟檔案</a></div>`;
            }).join('');

            const body = `<h3>文件掃描彙報</h3>${rows}`;

            try {
                await sendNotificationEmail(email, subject, body);
            } catch (err) {
                console.error(`Failed to send digest to ${email}`);
            }
        }

        let resultMsg = `Scanned ${processedCount} new files, found ${matchCount} matches.`;
        if (errors.length > 0) {
            resultMsg += ` Errors: ${errors.length}`;
        }
        await logSystemEvent('Drive_Scan', 'SUCCESS', resultMsg);

        return { success: errors.length === 0, message: resultMsg, errors };

    } catch (error: any) {
        console.error('Scan Fatal Error:', error);
        await logSystemEvent('Scanner_Fatal', 'ERROR', error.message);
        throw error;
    }
}
