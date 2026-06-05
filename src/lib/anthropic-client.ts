import Anthropic from '@anthropic-ai/sdk';

const cleanKey = (key: string | undefined) =>
    (key || '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim();

export const CLAUDE_MODEL = 'claude-opus-4-7';

export function getAnthropicClient(apiKey?: string): Anthropic {
    const effectiveKey = cleanKey(apiKey || process.env.ANTHROPIC_API_KEY);
    if (!effectiveKey) throw new Error('Missing ANTHROPIC_API_KEY');
    return new Anthropic({ apiKey: effectiveKey });
}

export async function callClaude(
    prompt: string,
    apiKey?: string,
    maxTokens = 16000
): Promise<string> {
    const client = getAnthropicClient(apiKey);
    const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
    );
    return textBlock?.text ?? '';
}
