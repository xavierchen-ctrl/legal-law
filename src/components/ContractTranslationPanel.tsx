'use client';

import { useState } from 'react';
import type { TranslationResult, TranslationClause } from '@/lib/translation-service';
import LoadingModal from './LoadingModal';

interface Props {
    documentName?: string;
    contractNumber?: string;
}

type InputMode = 'text' | 'drive';

function AmbiguityBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
            ⚠️ {count} 處多義
        </span>
    );
}

function ClauseCard({ clause }: { clause: TranslationClause }) {
    const [showOriginal, setShowOriginal] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showAmbiguities, setShowAmbiguities] = useState(clause.ambiguities.length > 0);

    return (
        <div className="rounded-lg border border-gray-200 bg-white mb-3 overflow-hidden shadow-sm">
            {/* Clause header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                <span className="text-xs font-bold text-indigo-700 flex-1">{clause.clauseTitle}</span>
                <AmbiguityBadge count={clause.ambiguities.length} />
                {clause.legalTerms.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 font-medium">
                        {clause.legalTerms.length} 個法律用語
                    </span>
                )}
            </div>

            <div className="px-4 py-3 space-y-3">
                {/* Chinese translation — main content */}
                <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">繁體中文譯文</p>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{clause.translatedText}</p>
                </div>

                {/* Ambiguity flags — show prominently if present */}
                {clause.ambiguities.length > 0 && (
                    <div>
                        <button
                            onClick={() => setShowAmbiguities(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                        >
                            <span>{showAmbiguities ? '▼' : '▶'}</span>
                            ⚠️ 多重解釋標示 ({clause.ambiguities.length} 處)
                        </button>
                        {showAmbiguities && (
                            <div className="mt-2 space-y-2">
                                {clause.ambiguities.map((amb, i) => (
                                    <div key={i} className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                                        <p className="text-xs font-mono text-amber-800 mb-1">「{amb.originalText}」</p>
                                        <p className="text-xs text-amber-700 mb-1">{amb.issue}</p>
                                        {amb.alternatives.length > 0 && (
                                            <ul className="text-xs text-amber-600 space-y-0.5">
                                                {amb.alternatives.map((alt, j) => (
                                                    <li key={j} className="flex gap-1">
                                                        <span className="font-bold">{j === 0 ? 'A' : 'B'}.</span>
                                                        <span>{alt}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Legal terms */}
                {clause.legalTerms.length > 0 && (
                    <div>
                        <button
                            onClick={() => setShowTerms(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            <span>{showTerms ? '▼' : '▶'}</span>
                            關鍵法律用語 ({clause.legalTerms.length})
                        </button>
                        {showTerms && (
                            <div className="mt-2 grid grid-cols-1 gap-1.5">
                                {clause.legalTerms.map((t, i) => (
                                    <div key={i} className="flex items-start gap-2 bg-indigo-50 rounded px-2 py-1.5 border border-indigo-100">
                                        <span className="text-xs font-mono text-indigo-700 font-bold shrink-0">{t.term}</span>
                                        <span className="text-gray-400 text-xs shrink-0">→</span>
                                        <span className="text-xs text-indigo-800 font-medium shrink-0">{t.translation}</span>
                                        {t.note && <span className="text-xs text-gray-500 ml-1">（{t.note}）</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Original English — collapsible */}
                <div>
                    <button
                        onClick={() => setShowOriginal(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <span>{showOriginal ? '▼' : '▶'}</span>
                        查看原文
                    </button>
                    {showOriginal && (
                        <div className="mt-2 bg-gray-50 rounded border border-gray-200 px-3 py-2">
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-mono">{clause.originalText}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ContractTranslationPanel({ documentName, contractNumber }: Props) {
    const [mode, setMode] = useState<InputMode>('text');
    const [rawText, setRawText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TranslationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showGlossary, setShowGlossary] = useState(false);

    const handleTranslate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const body =
                mode === 'text'
                    ? { rawText }
                    : { documentName, contractNumber };

            const res = await fetch('/api/contract-translation', {
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

    const totalAmbiguities = result?.clauses.reduce((sum, c) => sum + c.ambiguities.length, 0) ?? 0;
    const canSubmit = mode === 'text' ? rawText.trim().length > 20 : !!documentName;

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-blue-100 bg-gradient-to-b from-white to-blue-50/30">
            <LoadingModal
                open={loading}
                title="AI 翻譯處理中..."
                message="合約較長時通常需要 40～60 秒，系統正在將英文條款翻譯為繁體中文並分析法律用語"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-blue-100 pb-3">
                <span className="text-lg">🌐</span>
                <h3 className="text-base font-semibold text-blue-900">英文條款翻譯 (AI)</h3>
                <span className="ml-auto text-xs text-blue-400 font-medium">法律效果保留</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                將英文合約條款翻譯為繁體中文，保留法律效果與語氣，並標示關鍵法律用語與多義疑慮，供內部審閱及溝通使用。
            </p>

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

            {/* Input area */}
            {mode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="請貼上英文合約條款原文..."
                    rows={7}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-800 placeholder-gray-400"
                />
            ) : (
                <div className="bg-white rounded p-3 border border-gray-100">
                    <label className="text-xs text-gray-400 block mb-1">目標文件</label>
                    <div className="text-sm font-medium text-gray-700 truncate" title={documentName}>
                        📄 {documentName || '未命名檔案'}
                    </div>
                </div>
            )}

            {/* Translate button */}
            <button
                onClick={handleTranslate}
                disabled={loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
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
                    <div className={`rounded-lg px-4 py-3 border bg-white shadow-sm flex items-start gap-3 ${totalAmbiguities > 0 ? 'border-amber-200' : 'border-green-200'}`}>
                        <span className="text-xl mt-0.5">{totalAmbiguities > 0 ? '⚠️' : '✅'}</span>
                        <div>
                            <p className={`text-sm font-bold ${totalAmbiguities > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                {totalAmbiguities > 0
                                    ? `翻譯完成，共標示 ${totalAmbiguities} 處多義疑慮，建議人工確認`
                                    : '翻譯完成，無多義疑慮，條款語意清晰'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{result.contractSummary}</p>
                        </div>
                    </div>

                    {/* Glossary */}
                    {result.glossary.length > 0 && (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 overflow-hidden">
                            <button
                                onClick={() => setShowGlossary(v => !v)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/50 transition-colors"
                            >
                                <span>{showGlossary ? '▼' : '▶'}</span>
                                📖 法律用語對照表（{result.glossary.length} 項）
                            </button>
                            {showGlossary && (
                                <div className="px-4 pb-3 grid grid-cols-1 gap-1.5">
                                    {result.glossary.map((t, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-white rounded px-2 py-1.5 border border-indigo-100">
                                            <span className="text-xs font-mono text-indigo-700 font-bold shrink-0">{t.term}</span>
                                            <span className="text-gray-400 text-xs shrink-0">→</span>
                                            <span className="text-xs text-indigo-800 font-medium shrink-0">{t.translation}</span>
                                            {t.note && <span className="text-xs text-gray-500">（{t.note}）</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Clause cards */}
                    <div className="max-h-[600px] overflow-y-auto pr-1 custom-scrollbar-tr">
                        {result.clauses.map(clause => (
                            <ClauseCard key={clause.id} clause={clause} />
                        ))}
                    </div>

                    <style jsx>{`
                        .custom-scrollbar-tr::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar-tr::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                        .custom-scrollbar-tr::-webkit-scrollbar-thumb { background: #c7c7cc; border-radius: 4px; }
                        .custom-scrollbar-tr::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
                    `}</style>
                </div>
            )}
        </div>
    );
}
