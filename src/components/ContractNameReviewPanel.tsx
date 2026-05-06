'use client';

import { useState } from 'react';
import type { NamePreambleReviewResult, NamePreambleReviewItem } from '@/lib/ai-service';
import LoadingModal from './LoadingModal';

interface Props {
    documentName?: string;
    contractNumber?: string;
}

type InputMode = 'text' | 'drive';

const STATUS_CONFIG = {
    PASS: { icon: '✅', label: '通過', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    WARN: { icon: '⚠️', label: '需注意', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    FAIL: { icon: '❌', label: '有問題', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
};

function ReviewItemCard({ item }: { item: NamePreambleReviewItem }) {
    const [showSuggestion, setShowSuggestion] = useState(item.status !== 'PASS');
    const cfg = STATUS_CONFIG[item.status];

    return (
        <div className={`rounded-lg border ${cfg.border} ${cfg.bg} mb-2 overflow-hidden`}>
            <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-base shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${cfg.text}`}>{item.category}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.title}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                    {cfg.label}
                </span>
            </div>

            <div className="px-4 pb-3 space-y-2 border-t border-current/10">
                <p className="text-xs text-gray-700 leading-relaxed pt-2 whitespace-pre-wrap">{item.detail}</p>

                {item.suggestion && (
                    <div>
                        <button
                            onClick={() => setShowSuggestion(v => !v)}
                            className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.text} hover:opacity-80 transition-opacity`}
                        >
                            <span>{showSuggestion ? '▼' : '▶'}</span>
                            💡 修正建議
                        </button>
                        {showSuggestion && (
                            <div className={`mt-1.5 rounded-md border ${cfg.border} bg-white px-3 py-2`}>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{item.suggestion}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ContractNameReviewPanel({ documentName, contractNumber }: Props) {
    const [mode, setMode] = useState<InputMode>('text');
    const [rawText, setRawText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<NamePreambleReviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSuggestedName, setShowSuggestedName] = useState(false);
    const [showSuggestedPreamble, setShowSuggestedPreamble] = useState(false);

    const handleReview = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const body = mode === 'text'
                ? { rawText }
                : { documentName, contractNumber };

            const res = await fetch('/api/contract-name-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '審閱失敗');
            setResult(data.result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = mode === 'text' ? rawText.trim().length > 20 : !!documentName;
    const failCount = result?.items.filter(i => i.status === 'FAIL').length ?? 0;
    const warnCount = result?.items.filter(i => i.status === 'WARN').length ?? 0;
    const hasIssues = failCount > 0 || warnCount > 0;

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-orange-100 bg-gradient-to-b from-white to-orange-50/20">
            <LoadingModal
                open={loading}
                title="AI 審閱中..."
                message="正在分析契約名稱與前言是否符合交易本質，通常需要 15～25 秒"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-orange-100 pb-3">
                <span className="text-lg">📋</span>
                <h3 className="text-base font-semibold text-orange-900">契約名稱與前言審閱 (AI)</h3>
                <span className="ml-auto text-xs text-orange-400 font-medium">交易本質確認</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                確認契約名稱與前言是否正確反映交易本質與法律性質，避免定位錯誤或產生解釋爭議，並提供修正建議。
            </p>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                    onClick={() => setMode('text')}
                    className={`flex-1 py-2 transition-colors ${mode === 'text' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    貼上文字
                </button>
                <button
                    onClick={() => setMode('drive')}
                    disabled={!documentName}
                    className={`flex-1 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'drive' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    從 Drive 載入
                </button>
            </div>

            {/* Input */}
            {mode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="請貼上合約全文（含契約名稱、當事人、前言及主要條款）..."
                    rows={7}
                    className="w-full text-xs border border-orange-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-orange-300 bg-orange-50/20 text-gray-800 placeholder-gray-400"
                />
            ) : (
                <div className="bg-white rounded p-3 border border-gray-100">
                    <label className="text-xs text-gray-400 block mb-1">目標文件</label>
                    <div className="text-sm font-medium text-gray-700 truncate" title={documentName}>
                        📄 {documentName || '未命名檔案'}
                    </div>
                </div>
            )}

            {/* Button */}
            <button
                onClick={handleReview}
                disabled={loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        AI 審閱中...
                    </>
                ) : (
                    <>📋 執行名稱與前言審閱</>
                )}
            </button>

            {/* Error */}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-3 pt-1">
                    {/* Summary banner */}
                    <div className={`rounded-lg px-4 py-3 border bg-white shadow-sm flex items-start gap-3 ${
                        failCount > 0 ? 'border-red-200' : warnCount > 0 ? 'border-amber-200' : 'border-green-200'
                    }`}>
                        <span className="text-xl mt-0.5">
                            {failCount > 0 ? '❌' : warnCount > 0 ? '⚠️' : '✅'}
                        </span>
                        <div>
                            <p className={`text-sm font-bold ${failCount > 0 ? 'text-red-700' : warnCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                {failCount > 0
                                    ? `發現 ${failCount} 項問題，${warnCount} 項需注意`
                                    : warnCount > 0
                                    ? `${warnCount} 項需注意，建議修正`
                                    : '名稱與前言審閱通過，無明顯問題'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{result.overallAssessment}</p>
                        </div>
                    </div>

                    {/* Suggested corrections */}
                    {(result.suggestedName || result.suggestedPreamble) && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-blue-100">
                                <p className="text-xs font-bold text-blue-700">✏️ AI 建議修正版本</p>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                                {result.suggestedName && (
                                    <div>
                                        <button
                                            onClick={() => setShowSuggestedName(v => !v)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                                        >
                                            <span>{showSuggestedName ? '▼' : '▶'}</span>
                                            建議契約名稱
                                        </button>
                                        {showSuggestedName && (
                                            <div className="mt-1.5 rounded bg-white border border-blue-200 px-3 py-2">
                                                <p className="text-xs font-medium text-blue-800">{result.suggestedName}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {result.suggestedPreamble && (
                                    <div>
                                        <button
                                            onClick={() => setShowSuggestedPreamble(v => !v)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                                        >
                                            <span>{showSuggestedPreamble ? '▼' : '▶'}</span>
                                            建議前言修正
                                        </button>
                                        {showSuggestedPreamble && (
                                            <div className="mt-1.5 rounded bg-white border border-blue-200 px-3 py-2">
                                                <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-wrap">{result.suggestedPreamble}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 5 review items */}
                    <div className="max-h-[520px] overflow-y-auto pr-1 custom-scrollbar-name">
                        {result.items.map(item => (
                            <ReviewItemCard key={item.id} item={item} />
                        ))}
                    </div>

                    <style jsx>{`
                        .custom-scrollbar-name::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar-name::-webkit-scrollbar-track { background: #fff7ed; border-radius: 4px; }
                        .custom-scrollbar-name::-webkit-scrollbar-thumb { background: #fdba74; border-radius: 4px; }
                        .custom-scrollbar-name::-webkit-scrollbar-thumb:hover { background: #fb923c; }
                    `}</style>
                </div>
            )}
        </div>
    );
}
