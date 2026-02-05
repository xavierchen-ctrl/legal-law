
import 'dotenv/config'; // Load env vars BEFORE other imports
import { sendNotificationEmail } from './lib/email';

async function sendTest() {
    const target = 'caesarliu@wavenet.com.tw'; // Default testing email
    const subject = '[每日掃描彙報] 發現 2 個關注檔案 (測試)';

    // Simulate multiple items
    const items = [
        {
            fileName: '2025_Q1_機密報價單.pdf',
            link: 'https://drive.google.com/file/d/test-id-1/view',
            keywords: ['機密', '報價']
        },
        {
            fileName: '人事資遣名單_草稿.docx',
            link: 'https://drive.google.com/file/d/test-id-2/view',
            keywords: ['資遣', '薪資']
        }
    ];

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
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h3 style="color: #2c3e50;">文件掃描每日彙報 (測試)</h3>
            <p>系統在今日掃描中，為您發現了以下 ${items.length} 個包含關注關鍵字的檔案：</p>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; border: 1px solid #ddd;">
                ${rows}
            </div>
            <p style="font-size: 12px; color: gray; margin-top: 20px;">
                此為每日自動掃描報告 (${new Date().toLocaleDateString()}) - 系統測試信
            </p>
        </div>
    `;

    console.log(`Sending to ${target}...`);
    try {
        await sendNotificationEmail(target, subject, body);
        console.log('✅ Test email sent successfully.');
    } catch (error) {
        console.error('❌ Failed to send:', error);
    }
}

sendTest();
