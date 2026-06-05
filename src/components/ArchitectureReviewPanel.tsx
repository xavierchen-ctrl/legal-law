'use client';

import { useState, useRef } from 'react';
import type { ArchitectureReviewItem } from '@/lib/ai-service';
import LoadingModal from './LoadingModal';

interface Props {
    documentName: string;
    contractNumber: string;
}

type DocInputMode = 'file' | 'text';
type DocStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DocEntry {
    id: number;
    label: string;
    version: string;
    inputMode: DocInputMode;
    text: string;
    status: DocStatus;
    error: string | null;
    fileName: string | null;
    charCount: number;
}

const DOC_LABELS = [
    '主約（主合約）',
    '報價單',
    '工作說明書（SOW）',
    'SLA（服務等級協議）',
    'DPA（資料處理協議）',
    'NDA（保密協議）',
    '規格書',
    '驗收標準',
    '時程表',
    'Email 補充',
    '其他附件',
];

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

let nextId = 2;

function DocEntryCard({
    entry,
    onUpdate,
    onRemove,
    canRemove,
}: {
    entry: DocEntry;
    onUpdate: (id: number, patch: Partial<DocEntry>) => void;
    onRemove: (id: number) => void;
    canRemove: boolean;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        onUpdate(entry.id, { status: 'loading', error: null, fileName: file.name, text: '', charCount: 0 });
        try {
            const fileMB = file.size / 1024 / 1024;
            if (file.size > 4 * 1024 * 1024) {
                throw new Error(`檔案太大（${fileMB.toFixed(1)} MB），上限 4 MB`);
            }
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/extract-text', { method: 'POST', body: form });
            let data: any;
            try { data = await res.json(); } catch { throw new Error('檔案解析失敗，請改用「貼上文字」模式'); }
            if (!res.ok) throw new Error(data.error ?? '解析失敗');
            onUpdate(entry.id, { status: 'ready', text: data.text, charCount: data.charCount, error: null });
        } catch (err: any) {
            onUpdate(entry.id, { status: 'error', error: err.message, fileName: null });
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={entry.label}
                    onChange={e => onUpdate(entry.id, { label: e.target.value })}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                >
                    {DOC_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <input
                    type="text"
                    value={entry.version}
                    onChange={e => onUpdate(entry.id, { version: e.target.value })}
                    placeholder="版本標記（選填，如 v2.1）"
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-gray-600"
                />
                <div className="flex rounded border border-gray-200 overflow-hidden text-xs ml-auto">
                    <button
                        onClick={() => onUpdate(entry.id, { inputMode: 'file', text: '', status: 'idle', error: null, fileName: null, charCount: 0 })}
                        className={`px-2 py-1 transition-colors ${entry.inputMode === 'file' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >上傳檔案</button>
                    <button
                        onClick={() => onUpdate(entry.id, { inputMode: 'text', text: '', status: 'idle', error: null, fileName: null, charCount: 0 })}
                        className={`px-2 py-1 transition-colors ${entry.inputMode === 'text' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >貼上文字</button>
                </div>
                {canRemove && (
                    <button onClick={() => onRemove(entry.id)} className="text-xs text-red-400 hover:text-red-600 px-1 font-bold" title="移除此文件">✕</button>
                )}
            </div>

            {entry.inputMode === 'file' ? (
                <div>
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                    {entry.status === 'ready' ? (
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2 rounded border border-green-200 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                        >
                            <span className="text-green-600">✅</span>
                            <span className="text-xs text-green-700 font-medium truncate flex-1">{entry.fileName}</span>
                            <span className="text-xs text-gray-400">{entry.charCount.toLocaleString()} 字元</span>
                            <span className="text-xs text-gray-400 underline">重新上傳</span>
                        </div>
                    ) : entry.status === 'loading' ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 bg-gray-50">
                            <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            <span className="text-xs text-gray-500">解析 {entry.fileName}...</span>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-1 px-3 py-4 rounded border-2 border-dashed border-indigo-200 bg-indigo-50/30 cursor-pointer hover:bg-indigo-50 transition-colors"
                        >
                            <span className="text-xl">📄</span>
                            <span className="text-xs text-indigo-600 font-medium">點擊上傳（PDF · DOCX · TXT，上限 4 MB）</span>
                            {entry.status === 'error' && <span className="text-xs text-red-500 mt-1">{entry.error}</span>}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <textarea
                        value={entry.text}
                        onChange={e => onUpdate(entry.id, { text: e.target.value, charCount: e.target.value.length, status: e.target.value.trim().length >= 30 ? 'ready' : 'idle' })}
                        placeholder={`貼上「${entry.label}」的完整文字內容...`}
                        rows={5}
                        className="w-full text-xs border border-indigo-200 rounded px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-indigo-50/10 text-gray-800 placeholder-gray-400"
                    />
                    {entry.text.length > 0 && (
                        <p className="text-xs text-gray-400 text-right mt-0.5">{entry.text.length.toLocaleString()} 字元</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ArchitectureReviewPanel({ documentName, contractNumber }: Props) {
    const [docs, setDocs] = useState<DocEntry[]>([
        { id: 1, label: '主約（主合約）', version: '', inputMode: 'file', text: '', status: 'idle', error: null, fileName: null, charCount: 0 },
    ]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ArchitectureReviewItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [analyzedManifest, setAnalyzedManifest] = useState<{ label: string; version: string | null; fileName: string; charCount: number; source: string }[] | null>(null);

    const updateDoc = (id: number, patch: Partial<DocEntry>) => {
        setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    };
    const removeDoc = (id: number) => {
        setDocs(prev => prev.filter(d => d.id !== id));
    };
    const addDoc = () => {
        if (docs.length >= 8) return;
        setDocs(prev => [...prev, {
            id: nextId++,
            label: '其他附件',
            version: '',
            inputMode: 'file',
            text: '',
            status: 'idle',
            error: null,
            fileName: null,
            charCount: 0,
        }]);
    };

    const readyDocs = docs.filter(d => d.status === 'ready');

    const handleReview = async () => {
        if (readyDocs.length === 0) return;

        setLoading(true);
        setError(null);
        setResults(null);
        setAnalyzedManifest(null);

        try {
            const payload = readyDocs.map(d => ({
                label: d.label,
                version: d.version || undefined,
                text: d.text,
            }));
            const res = await fetch('/api/architecture-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documents: payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '分析失敗');
            setResults(data.results);
            setAnalyzedManifest(
                readyDocs.map(d => ({
                    label: d.label,
                    version: d.version || null,
                    fileName: d.fileName ?? '（手動貼上）',
                    charCount: d.charCount,
                    source: d.inputMode === 'file' ? '上傳檔案' : '手動貼上',
                }))
            );
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
                message="正在分析合約架構，多份文件分析約需 20～40 秒"
            />

            {/* Header */}
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                <span className="text-lg">🤖</span>
                <h3 className="text-base font-semibold text-indigo-900">合約架構檢視 (AI)</h3>
                <span className="ml-auto text-xs text-indigo-400 font-medium">深度解析模型</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                上傳合約文件進行 5 大項度結構分析；上傳多份文件時，另加第 6 項「文件間矛盾分析」。最多支援 8 份文件。
            </p>

            {/* Doc entries */}
            <div className="space-y-2">
                {docs.map(d => (
                    <DocEntryCard
                        key={d.id}
                        entry={d}
                        onUpdate={updateDoc}
                        onRemove={removeDoc}
                        canRemove={docs.length > 1}
                    />
                ))}

                <button
                    onClick={addDoc}
                    disabled={docs.length >= 8}
                    className="w-full text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-lg py-2 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    ＋ 新增文件（{docs.length}/8）
                </button>

                {readyDocs.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-1.5 border border-gray-100">
                        已備妥 <span className="font-semibold text-indigo-600">{readyDocs.length}</span> 份文件，
                        {readyDocs.length > 1 ? '將進行合約套件分析（含文件間矛盾檢查）' : '將進行單一文件架構分析'}。
                    </div>
                )}
            </div>

            {/* Run button */}
            <button
                id="architecture-review-btn"
                onClick={handleReview}
                disabled={loading || readyDocs.length === 0}
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

            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Analyzed manifest */}
            {analyzedManifest && results && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-700 space-y-1.5">
                    <div className="font-semibold text-gray-600">📋 本次分析涵蓋文件清單</div>
                    {analyzedManifest.map((m, i) => (
                        <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 pl-2 border-l-2 border-indigo-200">
                            <span className="font-medium text-indigo-700">{m.label}</span>
                            {m.version && <span className="text-gray-400">版本：{m.version}</span>}
                            <span className="text-gray-500 truncate">{m.fileName}</span>
                            {m.charCount > 0 && <span className="text-gray-400">{m.charCount.toLocaleString()} 字元</span>}
                            <span className="text-gray-400">（{m.source}）</span>
                        </div>
                    ))}
                    <div className="text-amber-600 font-medium pt-0.5">⚠️ 分析結果僅反映上述文件內容，未列於清單之附件不在分析範圍。</div>
                </div>
            )}

            {/* Results */}
            {results && results.length > 0 && (
                <div className="space-y-3 pt-1">
                    <div className={`rounded-lg px-4 py-3 flex items-center gap-3 border bg-white shadow-sm ${
                        failCount > 0 ? 'border-red-200' : warnCount > 0 ? 'border-yellow-200' : 'border-green-200'
                    }`}>
                        <span className="text-xl">{failCount > 0 ? '❌' : warnCount > 0 ? '⚠️' : '✅'}</span>
                        <div className="flex-1">
                            <div className={`text-sm font-bold ${failCount > 0 ? 'text-red-700' : warnCount > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                                {failCount > 0 ? `發現 ${failCount} 項嚴重缺失或矛盾` : warnCount > 0 ? `發現 ${warnCount} 項需要注意的條款` : '合約架構與條款撰寫大致完整'}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 italic">AI 分析結果，僅供法務參考，需結合完整文件套件判斷</div>
                        </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar-arch">
                        {results.map((item) => (
                            <ReviewItemCard key={item.id} item={item} />
                        ))}
                    </div>
                    <style jsx>{`
                        .custom-scrollbar-arch::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar-arch::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                        .custom-scrollbar-arch::-webkit-scrollbar-thumb { background: #c7c7cc; border-radius: 4px; }
                        .custom-scrollbar-arch::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
                    `}</style>
                </div>
            )}
        </div>
    );
}
