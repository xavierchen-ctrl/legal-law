import OpenAI from 'openai';

const cleanKey = (key: string | undefined) =>
    (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

export const OPENAI_MODEL = 'gpt-4o-mini';

export function getOpenAIClient(apiKey?: string): OpenAI {
    const effectiveKey = cleanKey(apiKey || process.env.OPENAI_API_KEY);
    if (!effectiveKey) throw new Error('Missing OPENAI_API_KEY');
    return new OpenAI({ apiKey: effectiveKey });
}

function toFriendlyError(err: any): Error {
    const msg: string = err?.message ?? String(err);

    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        const retryMatch = msg.match(/try again in (\d+(?:\.\d+)?)/i);
        const retrySec = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;
        const retryHint = retrySec ? `（建議 ${retrySec} 秒後重試）` : '（請稍後再試）';
        return new Error(`⏳ AI 請求次數已達上限${retryHint}。請稍後再試或聯絡系統管理員。`);
    }

    if (msg.includes('401') || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('incorrect api key')) {
        return new Error('🔑 API Key 無效，請確認 OpenAI API Key 是否正確。');
    }

    if (msg.includes('402') || msg.toLowerCase().includes('insufficient_quota') || msg.toLowerCase().includes('billing')) {
        return new Error('💳 OpenAI 帳戶餘額不足，請至 platform.openai.com → Billing 儲值後再試。');
    }

    if (msg.includes('503') || msg.toLowerCase().includes('service unavailable')) {
        return new Error('🔧 OpenAI 服務暫時不可用，請稍後幾分鐘再試。');
    }

    return err instanceof Error ? err : new Error(msg);
}

export async function callOpenAI(
    prompt: string,
    apiKey?: string,
    maxTokens = 16000,
    jsonMode = false
): Promise<string> {
    try {
        const client = getOpenAIClient(apiKey);
        const response = await client.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        });
        return response.choices[0]?.message?.content ?? '';
    } catch (err: any) {
        throw toFriendlyError(err);
    }
}
