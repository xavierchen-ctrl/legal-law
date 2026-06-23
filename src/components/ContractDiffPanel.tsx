'use client';

import { useState, useRef } from 'react';
import type { ContractDiffResult, ClauseDiff, ChangeType, ImpactLevel, OurRole, RiskDirection, ResolvedRole } from '@/lib/diff-service';

type InputMode = 'text' | 'file';

interface VersionInputProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    accentColor: 'red' | 'green';
}

function VersionInput({ label, value, onChange, accentColor }: VersionInputProps) {
    const [mode, setMode] = useState<InputMode>('text');
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const borderColor = accentColor === 'red' ? 'border-red-200' : 'border-green-200';
    const bgColor = accentColor === 'red' ? 'bg-red-50/30' : 'bg-green-50/30';
    const ringColor = accentColor === 'red' ? 'focus:ring-red-300' : 'focus:ring-green-300';
    const activeTab = accentColor === 'red' ? 'bg-red-500 text-white' : 'bg-green-600 text-white';
    const dropBorder = accentColor === 'red' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50';
    const dropText = accentColor === 'red' ? 'text-red-600' : 'text-green-700';

    const handleFile = async (file: File) => {
        setUploadError(null);
        setUploading(true);
        setFileName(file.name);
        try {
            const fileMB = file.size / 1024 / 1024;
            if (file.size > 4 * 1024 * 1024) {
                throw new Error(`📁 檔案太大（${fileMB.toFixed(1)} MB），系統上限為 4 MB。\n建議：切換至上方「貼上文字」模式，直接貼上合約內容即可。`);
            }
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/extract-text', { method: 'POST', body: form });
            let data: any;
            try {
                data = await res.json();
            } catch {
                throw new Error('📁 檔案太大或伺服器無法處理。\n建議：切換至上方「貼上文字」模式，直接貼上合約內容即可。');
            }
            if (!res.ok) throw new Error(data.error ?? '解析失敗');
            onChange(data.text);
        } catch (err: any) {
            setUploadError(err.message);
            setFileName(null);
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500">{label}</label>
                {/* Mode toggle */}
                <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
                    <button
                        onClick={() => setMode('text')}
                        className={`px-2 py-1 transition-colors ${mode === 'text' ? activeTab : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                        貼上文字
                    </button>
                    <button
                        onClick={() => setMode('file')}
                        className={`px-2 py-1 transition-colors ${mode === 'file' ? activeTab : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                        上傳檔案
                    </button>
                </div>
            </div>

            {mode === 'text' ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={`貼上${label}全文...`}
                    rows={9}
                    className={`w-full text-xs border ${borderColor} rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 ${ringColor} ${bgColor} text-gray-800 placeholder-gray-400`}
                />
            ) : (
                <div
                    onDrop={onDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed ${dropBorder} rounded-lg px-3 py-6 cursor-pointer hover:brightness-95 transition-all min-h-[140px]`}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                    {uploading ? (
                        <>
                            <svg className={`animate-spin h-6 w-6 ${dropText}`} fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            <p className={`text-xs ${dropText}`}>解析中...</p>
                        </>
                    ) : fileName && value ? (
                        <>
                            <span className="text-2xl">✅</span>
                            <p className={`text-xs font-medium ${dropText}`}>{fileName}</p>
                            <p className="text-xs text-gray-400">{value.length.toLocaleString()} 字元已擷取</p>
                            <p className="text-xs text-gray-400 underline">點擊重新上傳</p>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl">📄</span>
                            <p className={`text-xs font-semibold ${dropText}`}>點擊或拖曳上傳</p>
                            <p className="text-xs text-gray-400">支援 PDF、DOCX、TXT</p>
                            <p className="text-xs text-gray-400">上限 4 MB</p>
                        </>
                    )}
                    {uploadError && <p className="text-xs text-red-500 text-center">{uploadError}</p>}
                </div>
            )}

            {/* Char count */}
            {value && (
                <p className="text-xs text-gray-400 text-right">{value.length.toLocaleString()} 字元</p>
            )}
        </div>
    );
}

const CHANGE_STYLES: Record<ChangeType, { label: string; bg: string; border: string; text: string; dot: string }> = {
    ADDED:     { label: '新增', bg: 'bg-green-50',  border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
    REMOVED:   { label: '刪除', bg: 'bg-red-50',    border: 'border-red-300',   text: 'text-red-700',   dot: 'bg-red-500' },
    MODIFIED:  { label: '修改', bg: 'bg-amber-50',  border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
    UNCHANGED: { label: '未變', bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-500',  dot: 'bg-gray-400' },
};

const IMPACT_STYLES: Record<ImpactLevel, { label: string; color: string }> = {
    HIGH:   { label: '高風險', color: 'text-red-600 bg-red-100 border-red-200' },
    MEDIUM: { label: '中風險', color: 'text-amber-600 bg-amber-100 border-amber-200' },
    LOW:    { label: '低風險', color: 'text-blue-600 bg-blue-100 border-blue-200' },
    NONE:   { label: '無影響', color: 'text-gray-500 bg-gray-100 border-gray-200' },
};

const RISK_STYLES = {
    HIGH:   { label: '高風險', banner: 'bg-red-50 border-red-300 text-red-700', icon: '🔴' },
    MEDIUM: { label: '中風險', banner: 'bg-amber-50 border-amber-300 text-amber-700', icon: '🟡' },
    LOW:    { label: '低風險', banner: 'bg-green-50 border-green-300 text-green-700', icon: '🟢' },
    NONE:   { label: '無變更', banner: 'bg-gray-50 border-gray-300 text-gray-600', icon: '⚪' },
};

const RISK_DIRECTION_STYLE: Record<RiskDirection, { label: string; icon: string; badge: string }> = {
    INCREASE_OUR_RISK: { label: '對我方不利', icon: '⚠️', badge: 'bg-red-100 text-red-700 border-red-300' },
    DECREASE_OUR_RISK: { label: '對我方有利', icon: '✅', badge: 'bg-green-100 text-green-700 border-green-300' },
    NEUTRAL:           { label: '中性影響',   icon: '➖', badge: 'bg-gray-100 text-gray-600 border-gray-300' },
    UNCLEAR:           { label: '方向不明',   icon: '❓', badge: 'bg-slate-100 text-slate-600 border-slate-300' },
};

const ROLE_LABEL: Record<ResolvedRole, { label: string; icon: string; badge: string }> = {
    PARTY_A: { label: '我方為甲方', icon: '🅰️', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    PARTY_B: { label: '我方為乙方', icon: '🅱️', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    UNCLEAR: { label: '角色不明確', icon: '❓', badge: 'bg-gray-50 text-gray-600 border-gray-200' },
};

function ClauseCard({ clause, view }: { clause: ClauseDiff; view: 'diff' | 'side' }) {
    const [expanded, setExpanded] = useState(clause.impactLevel === 'HIGH' || clause.changeType !== 'UNCHANGED');
    const cs = CHANGE_STYLES[clause.changeType as keyof typeof CHANGE_STYLES] ?? CHANGE_STYLES['UNCHANGED'];
    const is = IMPACT_STYLES[clause.impactLevel as keyof typeof IMPACT_STYLES] ?? IMPACT_STYLES['NONE'];
    const dirCfg = RISK_DIRECTION_STYLE[clause.riskDirection as RiskDirection] ?? RISK_DIRECTION_STYLE.UNCLEAR;

    return (
        <div className={`rounded-lg border ${cs.border} ${cs.bg} mb-2 overflow-hidden`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:brightness-95 transition-all flex-wrap"
            >
                <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />
                <span className={`text-xs font-bold flex-1 ${cs.text}`}>{clause.clauseTitle}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cs.text} border-current/30`}>
                    {cs.label}
                </span>
                {clause.riskDirection && clause.riskDirection !== 'UNCLEAR' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${dirCfg.badge}`}>
                        {dirCfg.icon} {dirCfg.label}
                    </span>
                )}
                {clause.impactLevel !== 'NONE' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${is.color}`}>
                        {is.label}
                    </span>
                )}
                <span className={`text-xs ${cs.text} ml-1`}>{expanded ? '▼' : '▶'}</span>
            </button>

            {expanded && (
                <div className="px-4 pb-3 space-y-3 border-t border-current/10">
                    {/* Side-by-side or diff view */}
                    {view === 'side' ? (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">舊版</p>
                                <div className={`rounded p-2 text-xs leading-relaxed whitespace-pre-wrap min-h-[60px] ${
                                    clause.changeType === 'REMOVED' ? 'bg-red-100 text-red-800 border border-red-200' :
                                    clause.changeType === 'MODIFIED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    'bg-white text-gray-600 border border-gray-200'
                                }`}>
                                    {clause.oldText ?? <span className="text-gray-400 italic">（此條款為新增，舊版不存在）</span>}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">新版</p>
                                <div className={`rounded p-2 text-xs leading-relaxed whitespace-pre-wrap min-h-[60px] ${
                                    clause.changeType === 'ADDED' ? 'bg-green-100 text-green-800 border border-green-200' :
                                    clause.changeType === 'MODIFIED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    'bg-white text-gray-600 border border-gray-200'
                                }`}>
                                    {clause.newText ?? <span className="text-gray-400 italic">（此條款已刪除）</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {clause.oldText && (
                                <div>
                                    <p className="text-xs font-semibold text-red-500 mb-1">－ 舊版</p>
                                    <div className="rounded p-2 bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed whitespace-pre-wrap">
                                        {clause.oldText}
                                    </div>
                                </div>
                            )}
                            {clause.newText && (
                                <div>
                                    <p className="text-xs font-semibold text-green-600 mb-1">＋ 新版</p>
                                    <div className="rounded p-2 bg-green-50 border border-green-200 text-xs text-green-800 leading-relaxed whitespace-pre-wrap">
                                        {clause.newText}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 客觀變動內容 */}
                    {clause.impactDescription && (
                        <div className="rounded p-2.5 border border-gray-200 bg-white text-xs text-gray-700 leading-relaxed">
                            <p className="font-semibold mb-1 text-gray-600">📄 變動內容（客觀說明）</p>
                            <p>{clause.impactDescription}</p>
                        </div>
                    )}

                    {/* 我方視角 vs 相對人視角 — 分流呈現 */}
                    {(clause.ourSideImpact || clause.counterpartyImpact) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {clause.ourSideImpact && (
                                <div className={`rounded p-2.5 border text-xs leading-relaxed ${dirCfg.badge}`}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <p className="font-semibold">👤 我方視角</p>
                                        <span className="text-xs px-1.5 py-0.5 rounded border font-medium leading-none">
                                            {dirCfg.icon} {dirCfg.label}
                                        </span>
                                    </div>
                                    <p>{clause.ourSideImpact}</p>
                                </div>
                            )}
                            {clause.counterpartyImpact && (
                                <div className="rounded p-2.5 border border-gray-200 bg-gray-50 text-xs text-gray-700 leading-relaxed">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <p className="font-semibold text-gray-600">🤝 相對人視角</p>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500 leading-none">參考用</span>
                                    </div>
                                    <p>{clause.counterpartyImpact}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 受影響項目 */}
                    {clause.affectedRights.length > 0 && (
                        <div className="rounded p-2.5 border border-orange-200 bg-orange-50 text-xs text-orange-800 leading-relaxed">
                            <p className="font-semibold mb-1">
                                📌 受影響項目
                                <span className="font-normal ml-1 opacity-75">（依條文異動推論）</span>
                            </p>
                            <ul className="space-y-0.5">
                                {clause.affectedRights.map((r, i) => (
                                    <li key={i} className="flex gap-1.5">
                                        <span className="font-bold shrink-0">•</span>
                                        <span>{r}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 pt-1.5 border-t border-orange-200 opacity-70 italic text-orange-700">
                                以上為 AI 延伸推論，需結合案件背景由法務人員判斷，非正式法律意見。
                            </p>
                        </div>
                    )}

                    {/* Review comment */}
                    {clause.reviewComment && (
                        <div className="rounded p-2.5 border border-purple-200 bg-purple-50 text-xs text-purple-700 leading-relaxed">
                            <p className="font-semibold mb-1">📋 審約意見追蹤</p>
                            <p>{clause.reviewComment}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function exportSummary(result: ContractDiffResult) {
    const role = ROLE_LABEL[result.resolvedRole] ?? ROLE_LABEL.UNCLEAR;
    const lines: string[] = [
        '=== 合約版本差異摘要報告 ===',
        `分析角色：${role.label}`,
        `判斷依據：${result.roleResolution || '—'}`,
        `對我方整體風險：${RISK_STYLES[result.overallRiskLevel].label}`,
        `總變動：${result.totalChanges} 條（新增 ${result.addedClauses}、刪除 ${result.removedClauses}、修改 ${result.modifiedClauses}）`,
        '',
        '【整體摘要】',
        result.summary,
        '',
        '【我方視角整體影響】',
        result.ourSideSummary || '—',
        '',
        '【相對人視角整體影響】',
        result.counterpartyImpactSummary || '—',
        '',
        '【主要風險（我方視角）】',
        ...result.majorRisks.map((r, i) => `${i + 1}. ${r}`),
        '',
        '【建議事項】',
        ...result.recommendations.map((r, i) => `${i + 1}. ${r}`),
        '',
        '=== 條款變動明細 ===',
    ];

    result.clauses
        .filter(c => c.changeType !== 'UNCHANGED')
        .forEach(c => {
            const dir = RISK_DIRECTION_STYLE[c.riskDirection]?.label || '—';
            lines.push('');
            lines.push(`【${CHANGE_STYLES[c.changeType].label}】${c.clauseTitle}（${IMPACT_STYLES[c.impactLevel].label}｜${dir}）`);
            if (c.oldText) lines.push(`舊版：${c.oldText}`);
            if (c.newText) lines.push(`新版：${c.newText}`);
            if (c.impactDescription) lines.push(`變動說明：${c.impactDescription}`);
            if (c.ourSideImpact) lines.push(`我方視角：${c.ourSideImpact}`);
            if (c.counterpartyImpact) lines.push(`相對人視角：${c.counterpartyImpact}`);
            if (c.reviewComment) lines.push(`審約：${c.reviewComment}`);
        });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `合約差異摘要_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ContractDiffPanel() {
    const [versionA, setVersionA] = useState('');
    const [versionB, setVersionB] = useState('');
    const [reviewComments, setReviewComments] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ContractDiffResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'diff' | 'side'>('side');
    const [filter, setFilter] = useState<ChangeType | 'ALL' | 'OUR_DISADVANTAGE' | 'OUR_ADVANTAGE'>('ALL');
    const [ourRole, setOurRole] = useState<OurRole>('AUTO');

    const handleCompare = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/contract-diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionA, versionB, reviewComments, ourRole }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '比對失敗');
            setResult(data.result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = versionA.trim().length > 10 && versionB.trim().length > 10;

    const filteredClauses = result?.clauses.filter(c => {
        if (filter === 'ALL') return c.changeType !== 'UNCHANGED';
        if (filter === 'OUR_DISADVANTAGE') return c.riskDirection === 'INCREASE_OUR_RISK';
        if (filter === 'OUR_ADVANTAGE') return c.riskDirection === 'DECREASE_OUR_RISK';
        return c.changeType === filter;
    }) ?? [];

    const disadvCount = result?.clauses.filter(c => c.riskDirection === 'INCREASE_OUR_RISK').length ?? 0;
    const advCount    = result?.clauses.filter(c => c.riskDirection === 'DECREASE_OUR_RISK').length ?? 0;

    const rs = result ? (RISK_STYLES[result.overallRiskLevel as keyof typeof RISK_STYLES] ?? RISK_STYLES['NONE']) : null;
    const noChanges = result ? result.totalChanges === 0 : false;

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-purple-100 bg-gradient-to-b from-white to-purple-50/20">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-purple-100 pb-3">
                <span className="text-lg">🔍</span>
                <h3 className="text-base font-semibold text-purple-900">合約版本差異比對 (AI)</h3>
                <span className="ml-auto text-xs text-purple-400 font-medium">Track Changes</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                輸入新舊兩版合約文字，AI 將逐條分析差異、標示修訂內容，並說明各項變動對我方權利義務的影響。
            </p>

            {/* Input area */}
            <div className="grid grid-cols-2 gap-3">
                <VersionInput
                    label="舊版合約"
                    value={versionA}
                    onChange={setVersionA}
                    accentColor="red"
                />
                <VersionInput
                    label="新版合約"
                    value={versionB}
                    onChange={setVersionB}
                    accentColor="green"
                />
            </div>

            {/* 我方角色 — 影響風險方向判讀 */}
            <div className="rounded-lg border border-purple-100 bg-white/60 px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold text-gray-600">
                    👤 我方角色
                    <span className="ml-1 font-normal text-gray-400">（影響風險方向判讀，務必先指定）</span>
                </p>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    {([
                        { v: 'AUTO',     label: '🤖 AI 自動判斷' },
                        { v: 'PARTY_A',  label: '🅰️ 我方為甲方' },
                        { v: 'PARTY_B',  label: '🅱️ 我方為乙方' },
                    ] as { v: OurRole; label: string }[]).map(opt => (
                        <button
                            key={opt.v}
                            onClick={() => setOurRole(opt.v)}
                            className={`flex-1 px-3 py-1.5 transition-colors ${ourRole === opt.v ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                    💡 相同的修訂會因角色不同而方向相反。例：違約金被刪除 — 甲方視角為「失去保障」（對我方不利）；乙方視角為「責任減輕」（對我方有利）。
                </p>
            </div>

            {/* Review comments toggle */}
            <div>
                <button
                    onClick={() => setShowReview(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                >
                    <span>{showReview ? '▼' : '▶'}</span>
                    📋 輸入過往審約意見（選填）
                </button>
                {showReview && (
                    <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="貼上過往法務或審約人員的審閱意見，AI 將追蹤這些意見是否在新版中被採納..."
                        rows={4}
                        className="mt-2 w-full text-xs border border-purple-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-purple-300 bg-purple-50/30 text-gray-800 placeholder-gray-400"
                    />
                )}
            </div>

            {/* Compare button */}
            <button
                onClick={handleCompare}
                disabled={loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        AI 比對分析中...
                    </>
                ) : (
                    <>🔍 執行版本比對</>
                )}
            </button>

            {/* Error */}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {result && rs && (
                <div className="space-y-3 pt-1">
                    {noChanges ? (
                        /* ── No substantive changes ── */
                        <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-5 flex flex-col items-center gap-2 text-center">
                            <span className="text-3xl">✅</span>
                            <p className="text-sm font-bold text-gray-700">條文內容無實質變更</p>
                            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">{result.summary}</p>
                            <div className="mt-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 leading-relaxed text-left max-w-sm">
                                <p className="font-semibold mb-0.5">可能的差異類型（均不屬條文變更）</p>
                                <ul className="space-y-0.5">
                                    <li>• 檔案名稱或版本號異動（如 V4 → V5）</li>
                                    <li>• 封面、頁首或頁尾內容調整</li>
                                    <li>• 格式、排版或空白差異</li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 我方角色 + 分視角摘要 */}
                            {(() => {
                                const role = ROLE_LABEL[result.resolvedRole] ?? ROLE_LABEL.UNCLEAR;
                                return (
                                    <div className={`rounded-lg border px-3 py-2.5 ${role.badge}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-base">{role.icon}</span>
                                            <span className="text-xs font-bold">本次分析角色：{role.label}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded border border-current/40 bg-white/50">
                                                對我方不利 {disadvCount} 項 ／ 對我方有利 {advCount} 項
                                            </span>
                                        </div>
                                        {result.roleResolution && (
                                            <p className="text-xs mt-1 leading-relaxed opacity-90">判斷依據：{result.roleResolution}</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Risk banner */}
                            <div className={`rounded-lg px-4 py-3 border flex items-start gap-3 ${rs.banner}`}>
                                <span className="text-xl mt-0.5">{rs.icon}</span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold">
                                        對我方整體風險：{rs.label} ／ 共 {result.totalChanges} 處變動
                                        （新增 {result.addedClauses}、刪除 {result.removedClauses}、修改 {result.modifiedClauses}）
                                    </p>
                                    <p className="text-xs mt-0.5 leading-relaxed opacity-90">{result.summary}</p>
                                </div>
                                <button
                                    onClick={() => exportSummary(result)}
                                    className="shrink-0 text-xs px-2 py-1 rounded border border-current/30 hover:bg-white/50 transition-colors font-medium"
                                >
                                    ↓ 匯出摘要
                                </button>
                            </div>

                            {/* 分視角整體摘要 */}
                            {(result.ourSideSummary || result.counterpartyImpactSummary) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {result.ourSideSummary && (
                                        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                                            <p className="text-xs font-bold text-indigo-700 mb-1">👤 我方視角整體影響</p>
                                            <p className="text-xs text-indigo-800 leading-relaxed">{result.ourSideSummary}</p>
                                        </div>
                                    )}
                                    {result.counterpartyImpactSummary && (
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs font-bold text-gray-600 mb-1">🤝 相對人視角整體影響</p>
                                            <p className="text-xs text-gray-700 leading-relaxed">{result.counterpartyImpactSummary}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI 掃描覆蓋率說明 */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 space-y-1 leading-relaxed">
                                <div className="font-semibold">⚠️ AI 掃描範圍說明</div>
                                <div>
                                    本次已識別 <span className="font-medium">{result.clauses.length}</span> 條條款，
                                    其中有變動 <span className="font-medium">{result.totalChanges}</span> 條。
                                </div>
                                <div>若原始文件條號不連續、格式特殊或條文過長，AI 可能未完整辨識所有條款。建議核對原始文件確認有無遺漏。</div>
                                <div>畫面中標示「<span className="font-medium text-orange-600">💡 AI 延伸分析</span>」之內容為 AI 推論，<span className="font-medium">非正式法律意見</span>，不代表系統已完成完整法律風險判斷。</div>
                            </div>

                            {/* Major risks & recommendations */}
                            {(result.majorRisks.length > 0 || result.recommendations.length > 0) && (
                                <div className="grid grid-cols-2 gap-3">
                                    {result.majorRisks.length > 0 && (
                                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                            <p className="text-xs font-bold text-red-700 mb-0.5">⚠️ 主要風險</p>
                                            <p className="text-xs text-red-400 mb-2 italic">AI 延伸推論，非已確認法律風險</p>
                                            <ul className="space-y-1">
                                                {result.majorRisks.map((r, i) => (
                                                    <li key={i} className="text-xs text-red-600 flex gap-1.5">
                                                        <span className="shrink-0 font-bold">{i + 1}.</span>
                                                        <span>{r}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {result.recommendations.length > 0 && (
                                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                            <p className="text-xs font-bold text-blue-700 mb-0.5">💡 AI 修約建議方向</p>
                                            <p className="text-xs text-blue-400 mb-2 italic">供參考，需法務人員評估後決定</p>
                                            <ul className="space-y-1">
                                                {result.recommendations.map((r, i) => (
                                                    <li key={i} className="text-xs text-blue-600 flex gap-1.5">
                                                        <span className="shrink-0 font-bold">{i + 1}.</span>
                                                        <span>{r}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                                    <button
                                        onClick={() => setView('side')}
                                        className={`px-3 py-1.5 transition-colors ${view === 'side' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        並列視窗
                                    </button>
                                    <button
                                        onClick={() => setView('diff')}
                                        className={`px-3 py-1.5 transition-colors ${view === 'diff' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        差異標示
                                    </button>
                                </div>

                                <div className="flex gap-1.5 flex-wrap">
                                    {(['ALL', 'OUR_DISADVANTAGE', 'OUR_ADVANTAGE', 'MODIFIED', 'ADDED', 'REMOVED'] as const).map(f => {
                                        let count = 0;
                                        let label = '';
                                        let style = 'bg-gray-700 text-white';
                                        if (f === 'ALL') { count = result.totalChanges; label = '全部'; style = 'bg-gray-700 text-white'; }
                                        else if (f === 'OUR_DISADVANTAGE') { count = disadvCount; label = '⚠️ 對我方不利'; style = 'bg-red-600 text-white'; }
                                        else if (f === 'OUR_ADVANTAGE')    { count = advCount;    label = '✅ 對我方有利'; style = 'bg-green-600 text-white'; }
                                        else { count = result.clauses.filter(c => c.changeType === f).length; label = CHANGE_STYLES[f].label;
                                            style = f === 'ADDED' ? 'bg-green-600 text-white' : f === 'REMOVED' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white';
                                        }
                                        const active = filter === f;
                                        return (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                                                    active ? style : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                {label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Clause cards */}
                            <div className="max-h-[700px] overflow-y-auto pr-1 custom-scrollbar-diff">
                                {filteredClauses.length === 0 ? (
                                    <p className="text-xs text-center text-gray-400 py-6">無符合篩選條件的條款</p>
                                ) : (
                                    filteredClauses.map(clause => (
                                        <ClauseCard key={clause.id} clause={clause} view={view} />
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    <style jsx>{`
                        .custom-scrollbar-diff::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar-diff::-webkit-scrollbar-track { background: #f5f3ff; border-radius: 4px; }
                        .custom-scrollbar-diff::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 4px; }
                        .custom-scrollbar-diff::-webkit-scrollbar-thumb:hover { background: #a78bfa; }
                    `}</style>
                </div>
            )}
        </div>
    );
}
