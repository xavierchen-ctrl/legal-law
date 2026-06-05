import { GoogleGenerativeAI } from '@google/generative-ai';

const cleanKey = (key: string | undefined) =>
    (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

export const GEMINI_MODEL = 'gemini-2.0-flash';

export function getGeminiClient(apiKey?: string): GoogleGenerativeAI {
    const effectiveKey = cleanKey(apiKey || process.env.GEMINI_API_KEY);
    if (!effectiveKey) throw new Error('Missing GEMINI_API_KEY');
    return new GoogleGenerativeAI(effectiveKey);
}

function toFriendlyError(err: any): Error {
    const msg: string = err?.message ?? String(err);

    if (msg.includes('429') || msg.toLowerCase().includes('quota exceeded') || msg.toLowerCase().includes('too many requests')) {
        // 嘗試抓出 retryDelay 秒數
        const retryMatch = msg.match(/retryDelay["\s:]+["']?(\d+(?:\.\d+)?)s/);
        const retrySec = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;
        const retryHint = retrySec ? `（建議 ${retrySec} 秒後重試）` : '（請稍後再試）';
        return new Error(
            `⏳ AI 請求次數已達上限${retryHint}。\nGemini 免費方案每分鐘限制 15 次、每天 1,500 次。若頻繁出現此訊息，請稍後再試或洽系統管理員升級方案。`
        );
    }

    if (msg.includes('API key') || msg.includes('INVALID_ARGUMENT') || msg.includes('API_KEY_INVALID')) {
        return new Error('🔑 API Key 無效，請確認 Gemini API Key 是否正確。');
    }

    if (msg.includes('503') || msg.toLowerCase().includes('service unavailable') || msg.toLowerCase().includes('overloaded')) {
        return new Error('🔧 Gemini 服務暫時不可用，請稍後幾分鐘再試。');
    }

    if (msg.includes('SAFETY') || msg.toLowerCase().includes('safety')) {
        return new Error('🚫 AI 因安全設定拒絕處理此內容，請確認合約文字是否包含敏感資訊。');
    }

    return err instanceof Error ? err : new Error(msg);
}

export async function callGemini(
    prompt: string,
    apiKey?: string,
    maxTokens = 16000
): Promise<string> {
    try {
        const client = getGeminiClient(apiKey);
        const model = client.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { maxOutputTokens: maxTokens },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err: any) {
        throw toFriendlyError(err);
    }
}
