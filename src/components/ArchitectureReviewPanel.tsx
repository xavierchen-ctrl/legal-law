'use client';

import { useState } from 'react';
import type { ArchitectureReviewItem } from '@/lib/ai-service';
import LoadingModal from './LoadingModal';

interface Props {
    documentName: string;
    contractNumber: string;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; bg: string; border: string; text: string }> = {
    PASS: { icon: '✅', label: '具備', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    FAIL: { icon: '❌', label: '缺失/矛盾', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    WARN: { icon: '⚠️', label: '需注意', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
};

function ReviewItemCard({ item }: { item: ArchitectureReviewItem }) {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['WARN'];
    return (
        <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border} mb-2`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{cfg.icon}</span>
                <span className={`text-sm font-bold ${cfg.text}`}>{item.category}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                    {cfg.label}
                </span>
            </div>
            <p className="text-xs text-gray-700 font-semibold mb-1 pl-6">{item.title}</p>
            <p className="text-xs text-gray-600 leading-relaxed pl-6 whitespace-pre-wrap">{item.detail}</p>
        </div>
    );
}

export default function ArchitectureReviewPanel({ documentName, contractNumber }: Props) {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ArchitectureReviewItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleReview = async () => {
        if (!documentName) {
            setError('合約檔案名稱遺失，無法進行比對。');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const res = await fetch('/api/architecture-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentName, contractNumber }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error ?? '分析失敗');
            }
            
            setResults(data.results);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const failCount = results?.filter(c => c.status === 'FAIL').length ?? 0;
    const warnCount = results?.filter(c => c.status === 'WARN').length ?? 0;

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/30">
            <LoadingModal
                open={loading}
                title="AI 深度分析中..."
                message="正在讀取合約並進行 5 大項度架構分析，通常需要 15～20 秒"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                <span className="text-lg">🤖</span>
                <h3 className="text-base font-semibold text-indigo-900">合約架構檢視 (AI)</h3>
                <span className="ml-auto text-xs text-indigo-400 font-medium">深度解析模型</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                系統將自動從雲端硬碟讀取您的合約文件，進行 5 大項度的結構分析。請注意，這可能會需要約 15~20 秒的處理時間。
            </p>

            {/* Target Document Info */}
            <div className="bg-white rounded p-3 border border-gray-100">
                <label className="text-xs text-gray-400 block mb-1">目標比對檔案</label>
                <div className="text-sm font-medium text-gray-700 truncate" title={documentName}>
                    📄 {documentName || '未命名檔案'}
                </div>
            </div>

            {/* Verify Button */}
            <button
                id="architecture-review-btn"
                onClick={handleReview}
                disabled={loading || !documentName}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        AI 深度分析中...
                    </>
                ) : (
                    <>🔍 執行架構檢視</>
                )}
            </button>

            {/* Error */}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {results && results.length > 0 && (
                <div className="space-y-3 pt-2">
                    {/* Summary banner */}
                    <div className={`rounded-lg px-4 py-3 flex items-center gap-3 border bg-white shadow-sm ${
                        failCount > 0
                            ? 'border-red-200'
                            : warnCount > 0
                            ? 'border-yellow-200'
                            : 'border-green-200'
                    }`}>
                        <span className="text-xl">
                            {failCount > 0 ? '❌' : warnCount > 0 ? '⚠️' : '✅'}
                        </span>
                        <div className="flex-1">
                            <div className={`text-sm font-bold ${
                                failCount > 0 ? 'text-red-700' : warnCount > 0 ? 'text-yellow-700' : 'text-green-700'
                            }`}>
                                {failCount > 0
                                    ? `發現 ${failCount} 項嚴重缺失或矛盾`
                                    : warnCount > 0
                                    ? `發現 ${warnCount} 項需要注意的條款`
                                    : '合約架構與條款撰寫大致完整'}
                            </div>
                        </div>
                    </div>

                    {/* 5 check items */}
                    <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                        {results.map((item) => (
                            <ReviewItemCard key={item.id} item={item} />
                        ))}
                    </div>
                    <style jsx>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: #f1f1f1; 
                            border-radius: 4px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #c7c7cc; 
                            border-radius: 4px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #a1a1aa; 
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
