'use client';

import { useState } from 'react';

export default function ManualScanButton() {
    const [loading, setLoading] = useState(false);

    const handleScan = async () => {
        const userKey = localStorage.getItem('legal_flow_user_api_key');

        // Simple check for admin status via cookie (since we don't have a robust auth hook here yet)
        // In a real app we'd use useSession() or similar. 
        // Assuming "token" cookie exists for logged-in users, but we specifically want to know if it's YOU (Admin).
        // Since we don't have user roles in local storage easily, we can check for a specific flag or just apply the logic:
        // "If no key provided, ask for confirmation (Admin/Default behavior) OR block (User behavior)"

        // For now, let's look for the auth token. If you are logged in, you effectively have access.
        // But to distinguish YOU from OTHERS without a DB call is tricky solely on client side if roles aren't stored.
        // HACK: We can check if the user is on localhost (dev) or if a specific localStorage flag 'is_admin' is set?
        // OR: Since you are the one deploying, maybe we just default to "Warning" mode.

        // Wait, the user said "I don't want to key it in". 
        // Let's invert the logic: 
        // 1. If Key exists -> Use it.
        // 2. If Key doesn't exist:
        //    -> Are you the Admin? (How do we know?)

        // Let's try to read the "token" cookie. If it corresponds to the specific admin email (hardcoded for now as a quick fix for you), allow it.
        // Actually, we can just allow the "Confirm" dialog to pass if the user clicks "OK", 
        // BUT show a VERY STRONG warning "You are using the SYSTEM QUOTA".
        // Regular users will likely be scared off or told by policy to use their own key.

        // BETTER: Let's just create a secret "Admin Mode" or rely on the fact that you know you can click "OK".
        // But you wanted to "Force" others.

        // Hybrid Approach:
        // If NO Key:
        //   Show Alert: "⚠️ 未偵測到個人 API Key！"
        //   "若您是管理員，請按 [確定] 繼續使用系統額度。"
        //   "若您是一般使用者，請按 [取消] 並前往右下角設定。"

        if (!userKey) {
            const passcode = prompt(
                '⚠️ 未偵測到個人 API Key！\n\n' +
                '若繼續將消耗【系統共用額度】。\n' +
                '一般使用者請按 [取消] 並前往設定個人 Key。\n\n' +
                '管理員請輸入通行碼以繼續：'
            );

            if (passcode !== 'wavenet') {
                if (passcode !== null) { // User typed something wrong, or empty
                    alert('通行碼錯誤，存取被拒絕。');
                }
                // If cancelled (null), or wrong code, guide to settings
                const settingsBtn = document.querySelector('button[title="設定個人 API Key"]') as HTMLButtonElement;
                if (settingsBtn) settingsBtn.click();
                return;
            }
            // If passcode is 'wavenet', allow fall-through to use system key (admin bypass)
        } else {
            if (!confirm('確定要執行手動掃描嗎？\n(將使用您的個人 API Key)')) return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/manual-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(userKey ? { 'x-gemini-api-key': userKey } : {})
                }
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const errors = data.details?.errors || [];
                if (errors.length > 0) {
                    alert(`部分完成！\n${data.message}\n\n⚠️ 發生錯誤：\n${errors.join('\n')}\n\n若顯示 429/Quota 相關錯誤，請檢查您的額度。`);
                } else {
                    alert(`掃描完成！\n${data.message}`);
                }
            } else {
                const errMsg = data.error || data.message || '未知錯誤';
                alert(`掃描失敗: ${errMsg}\n\n若顯示 429/Quota 相關錯誤，表示此 Key 的額度已用完。`);
            }
        } catch (error) {
            console.error(error);
            alert('發生錯誤，請查看 Console Log');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleScan}
            disabled={loading}
            className={`btn btn-secondary flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="手動觸發 Drive 掃描與 AI 分析"
        >
            <span>🚀</span>
            {loading ? '掃描中...' : '手動掃描'}
        </button>
    );
}
