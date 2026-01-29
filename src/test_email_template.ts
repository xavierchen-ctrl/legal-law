
import 'dotenv/config'; // Load env vars BEFORE other imports
import { sendNotificationEmail } from './lib/email';

async function sendTest() {
    const target = 'caesarliu@wavenet.com.tw'; // Default testing email
    const subject = '[測試信] Legal Alert: 發現關鍵字 (測試檔案)';
    const body = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h3 style="color: #d32f2f;">🚨 文件掃描通知 (測試)</h3>
            <p>系統在檔案 <strong>2025_Q1_機密報價單.pdf</strong> 中偵測到您設定的關鍵字：</p>
            <ul style="background-color: #f9f9f9; padding: 15px 30px; border-radius: 5px;">
                <li style="margin-bottom: 5px; font-weight: bold; color: #d32f2f;">機密</li>
                <li style="font-weight: bold; color: #d32f2f;">報價</li>
            </ul>
            <p>請前往 <a href="https://drive.google.com/file/d/test-file-id/view" target="_blank" style="color: #1a73e8; text-decoration: none;">Google Drive</a> 確認檔案內容。</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">此為系統測試信件，請忽略。</p>
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
