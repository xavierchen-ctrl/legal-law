'use client';

import { useState } from 'react';
import type { GenericLangPair, GenericTranslationResult } from '@/lib/translation-service';
import LoadingModal from './LoadingModal';

interface Props {
    langPair: GenericLangPair;
    documentName?: string;
    contractNumber?: string;
}

const LANG_LABELS: Record<GenericLangPair, { title: string; placeholder: string; resultLabel: string; color: string }> = {
    'zh-ja':  { title: '中文翻日文 (AI)',    placeholder: '請貼上繁體中文合約條款原文...',  resultLabel: '日文譯文',   color: 'rose' },
    'ja-zh':  { title: '日文翻中文 (AI)',    placeholder: '請貼上日文合約條款原文...',      resultLabel: '繁體中文譯文', color: 'rose' },
    'zh-zhs': { title: '繁體中文翻簡體中文 (AI)', placeholder: '請貼上繁體中文合約條款原文...', resultLabel: '簡體中文譯文', color: 'orange' },
    'zhs-zh': { title: '簡體中文翻繁體中文 (AI)', placeholder: '請貼上簡體中文合約條款原文...', resultLabel: '繁體中文譯文', color: 'orange' },
    'zh-vi':  { title: '中文翻越南文 (AI)',   placeholder: '請貼上繁體中文合約條款原文...',  resultLabel: '越南文譯文',  color: 'green' },
    'vi-zh':  { title: '越南文翻中文 (AI)',   placeholder: '請貼上越南文合約條款原文...',    resultLabel: '繁體中文譯文', color: 'green' },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; btn: string }> = {
    rose:   { bg: 'from-rose-50/30',   border: 'border-rose-100',   text: 'text-rose-900',   btn: 'from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700' },
    orange: { bg: 'from-orange-50/30', border: 'border-orange-100', text: 'text-orange-900', btn: 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700' },
    green:  { bg: 'from-green-50/30',  border: 'border-green-100',  text: 'text-green-900',  btn: 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' },
};

export default function ContractGenericTranslationPanel({ langPair, documentName, contractNumber }: Props) {
    const [mode, setMode] = useState<'text' | 'drive'>('text');
    const [rawText, setRawText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GenericTranslationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const meta = LANG_LABELS[langPair];
    const colors = COLOR_MAP[meta.color];
    const canSubmit = mode === 'text' ? rawText.trim().length > 20 : !!documentName;

    const handleTranslate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const body = mode === 'text'
                ? { rawText, langPair }
                : { documentName, contractNumber, langPair };

            const res = await fetch('/api/contract-translation-generic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '翻譯失敗');
            setResult(data.result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`card p-6 space-y-4 shadow-sm border ${colors.border} bg-gradient-to-b from-white ${colors.bg}`}>
            <LoadingModal
                open={loading}
                title="AI 翻譯處理中..."
                message="合約較長時通常需要 40～60 秒，AI 正在翻譯並保留法律效力"
            />

            <div className={`flex items-center gap-2 border-b ${colors.border} pb-3`}>
                <span className="text-lg">🌐</span>
                <h3 className={`text-base font-semibold ${colors.text}`}>{meta.title}</h3>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                    onClick={() => setMode('text')}
                    className={`flex-1 py-2 transition-colors ${mode === 'text' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    貼上文字
                </button>
                <button
                    onClick={() => setMode('drive')}
                    disabled={!documentName}
                    className={`flex-1 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'drive' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    從 Drive 載入
                </button>
            </div>

            {mode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={meta.placeholder}
                    rows={7}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-800 placeholder-gray-400"
                />
            ) : (
                <div className="bg-white rounded p-3 border border-gray-100">
                    <label className="text-xs text-gray-400 block mb-1">目標文件</label>
                    <div className="text-sm font-medium text-gray-700 truncate">📄 {documentName || '未命名檔案'}</div>
                </div>
            )}

            <button
                onClick={handleTranslate}
                disabled={loading || !canSubmit}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r ${colors.btn} disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        AI 翻譯中...
                    </>
                ) : (
                    <>🌐 執行翻譯</>
                )}
            </button>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {result && (
                <div className="space-y-3 pt-1">
                    <div className="rounded-lg px-4 py-3 border border-green-200 bg-white shadow-sm">
                        <p className="text-sm font-bold text-green-700 mb-1">✅ 翻譯完成</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{result.summary}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-400 mb-2 font-medium">{meta.resultLabel}</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result.translatedText}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
