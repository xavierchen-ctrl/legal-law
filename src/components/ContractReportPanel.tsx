'use client';

import { useState } from 'react';
import LoadingModal from './LoadingModal';
import FileUploadZone from './FileUploadZone';
import type {
    ContractReportResult, RiskItem, RiskLevel, RiskClassification, SigningRec
} from '@/lib/report-service';

interface Props {
    documentName?: string;
    contractNumber?: string;
}

type InputMode = 'text' | 'upload';

// ── Style maps ──────────────────────────────────────────────────────────────

const RISK_LEVEL: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
    HIGH:   { label: '高風險', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-500' },
    MEDIUM: { label: '中風險', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500' },
    LOW:    { label: '低風險', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500' },
};

const CLASSIFICATION: Record<RiskClassification, { label: string; color: string; bg: string; border: string }> = {
    MUST_FIX:   { label: '必須修改', color: 'text-red-600',  bg: 'bg-red-100',   border: 'border-red-300' },
    ACCEPTABLE: { label: '可接受風險', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
};

const SIGNING_REC: Record<SigningRec, { label: string; icon: string; banner: string; color: string }> = {
    APPROVE:                  { label: '建議簽署',         icon: '✅', banner: 'border-green-300 bg-green-50',  color: 'text-green-700' },
    APPROVE_WITH_MODIFICATIONS: { label: '修正後可簽署',   icon: '⚠️', banner: 'border-amber-300 bg-amber-50',  color: 'text-amber-700' },
    REJECT:                   { label: '建議拒絕簽署',     icon: '❌', banner: 'border-red-300 bg-red-50',      color: 'text-red-700' },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function RiskCard({ item }: { item: RiskItem }) {
    const rl = RISK_LEVEL[item.level];
    const cl = CLASSIFICATION[item.classification];
    return (
        <div className={`rounded-lg border ${rl.border} ${rl.bg} px-4 py-3 mb-2`}>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`w-2 h-2 rounded-full shrink-0 ${rl.dot}`} />
                <span className="text-xs font-bold text-gray-700 flex-1">{item.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${rl.color} ${rl.bg} ${rl.border}`}>
                    {rl.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cl.color} ${cl.bg} ${cl.border}`}>
                    {cl.label}
                </span>
            </div>
            <p className="text-xs text-gray-700 mb-1.5 leading-relaxed">{item.description}</p>
            <div className="bg-white/70 rounded px-2.5 py-1.5 border border-current/10">
                <p className="text-xs text-gray-500 font-semibold mb-0.5">實際影響</p>
                <p className="text-xs text-gray-700 leading-relaxed">{item.actualImpact}</p>
            </div>
        </div>
    );
}

function BulletList({ items, color = 'text-gray-700' }: { items: string[]; color?: string }) {
    if (!items || items.length === 0) return <p className="text-xs text-gray-400 italic">（無）</p>;
    return (
        <ul className="space-y-1.5">
            {items.map((item, i) => (
                <li key={i} className={`flex gap-2 text-xs leading-relaxed ${color}`}>
                    <span className="shrink-0 font-bold mt-0.5">•</span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2.5">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold text-gray-500 whitespace-nowrap px-2">{title}</span>
                <div className="h-px flex-1 bg-gray-200" />
            </div>
            {children}
        </div>
    );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportReport(result: ContractReportResult, contractNumber?: string) {
    const rec = SIGNING_REC[result.signingRecommendation.recommendation];
    const lines: string[] = [
        `合約審閱報告`,
        `合約編號：${contractNumber ?? '—'}`,
        `產出時間：${new Date().toLocaleString('zh-TW')}`,
        `\n${'='.repeat(60)}`,
        `\n【壹、風險彙整】整體風險：${RISK_LEVEL[result.riskSummary.overallRisk].label}`,
        `\n${result.riskSummary.conclusion}`,
        '',
    ];

    result.riskSummary.items.forEach(item => {
        lines.push(`▸ [${RISK_LEVEL[item.level].label}][${CLASSIFICATION[item.classification].label}] ${item.category}`);
        lines.push(`  風險說明：${item.description}`);
        lines.push(`  實際影響：${item.actualImpact}`);
        lines.push('');
    });

    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`\n【貳、內部說明】`);
    lines.push(`\n摘要：${result.internalExplanation.summary}`);
    lines.push('\n重點說明：');
    result.internalExplanation.keyPoints.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    lines.push('\n修訂建議：');
    result.internalExplanation.revisionSuggestions.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    lines.push('\n注意事項：');
    result.internalExplanation.riskReminders.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));

    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`\n【參、簽署建議】${rec.label}`);
    lines.push(`\n說明：${result.signingRecommendation.rationale}`);

    if (result.signingRecommendation.unacceptableRisks.length > 0) {
        lines.push('\n不可接受風險：');
        result.signingRecommendation.unacceptableRisks.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    }
    if (result.signingRecommendation.requiredModifications.length > 0) {
        lines.push('\n必要修正項目：');
        result.signingRecommendation.requiredModifications.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    }
    if (result.signingRecommendation.acceptableRisks.length > 0) {
        lines.push('\n可接受風險：');
        result.signingRecommendation.acceptableRisks.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    }
    if (result.signingRecommendation.commercialBenefits.length > 0) {
        lines.push('\n商業利益：');
        result.signingRecommendation.commercialBenefits.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `合約審閱報告_${contractNumber ?? 'report'}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractReportPanel({ documentName, contractNumber }: Props) {
    const [mode, setMode] = useState<InputMode>('text');
    const [rawText, setRawText] = useState('');
    const [uploadedText, setUploadedText] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [businessBackground, setBusinessBackground] = useState('');
    const [showInputs, setShowInputs] = useState(false);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ContractReportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Active section tab
    const [section, setSection] = useState<'risk' | 'internal' | 'signing'>('risk');

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const textToSend = mode === 'text' ? rawText : uploadedText;
            const body = { rawText: textToSend, reviewNotes, businessBackground };

            const res = await fetch('/api/contract-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '產出失敗');
            setResult(data.result);
            setSection('risk');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = mode === 'text' ? rawText.trim().length > 20 : uploadedText.length > 20;

    const overallRl = result ? RISK_LEVEL[result.riskSummary.overallRisk] : null;
    const recStyle = result ? SIGNING_REC[result.signingRecommendation.recommendation] : null;
    const mustFixCount = result?.riskSummary.items.filter(i => i.classification === 'MUST_FIX').length ?? 0;

    const SECTION_TABS = [
        { id: 'risk' as const,     label: '風險彙整', icon: '⚠️' },
        { id: 'internal' as const, label: '內部說明', icon: '📣' },
        { id: 'signing' as const,  label: '簽署建議', icon: '✍️' },
    ];

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-rose-100 bg-gradient-to-b from-white to-rose-50/20">
            <LoadingModal
                open={loading}
                title="審閱報告產生中..."
                message="AI 正在分析合約風險並產生完整審閱報告，通常需要 20～40 秒"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
                <span className="text-lg">📊</span>
                <h3 className="text-base font-semibold text-rose-900">合約審閱報告 (AI)</h3>
                <span className="ml-auto text-xs text-rose-400 font-medium">風險彙整 · 內部說明 · 簽署建議</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                綜合合約內容、審閱結果與商業背景，產出風險彙整、內部說明及簽署建議三大報告區塊，供內部決策參考。
            </p>

            {/* Input mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                    onClick={() => setMode('text')}
                    className={`flex-1 py-2 transition-colors ${mode === 'text' ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    貼上合約
                </button>
                <button
                    onClick={() => setMode('upload')}
                    className={`flex-1 py-2 transition-colors ${mode === 'upload' ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    上傳檔案
                </button>
            </div>

            {mode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="請貼上合約全文..."
                    rows={6}
                    className="w-full text-xs border border-rose-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-rose-300 bg-rose-50/20 text-gray-800 placeholder-gray-400"
                />
            ) : (
                <>
                    <FileUploadZone
                        accentColor="rose"
                        onTextExtracted={(text) => { setUploadedText(text); setUploadError(null); }}
                        onError={msg => setUploadError(msg)}
                    />
                    {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                </>
            )}

            {/* Optional inputs */}
            <div>
                <button
                    onClick={() => setShowInputs(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-800 transition-colors"
                >
                    <span>{showInputs ? '▼' : '▶'}</span>
                    補充資料（審閱結果 / 商業背景）
                </button>
                {showInputs && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                條款審閱結果與修訂建議
                                <span className="font-normal text-gray-400 ml-1">（可貼入其他 AI 工具產出的結果）</span>
                            </label>
                            <textarea
                                value={reviewNotes}
                                onChange={e => setReviewNotes(e.target.value)}
                                placeholder="貼入審閱意見、風險分析、差異比對結果等..."
                                rows={4}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                商業背景與需求
                                <span className="font-normal text-gray-400 ml-1">（需求單位說明）</span>
                            </label>
                            <textarea
                                value={businessBackground}
                                onChange={e => setBusinessBackground(e.target.value)}
                                placeholder="說明此次交易的商業目的、重要性、時間壓力或其他背景..."
                                rows={3}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        AI 產出報告中...
                    </>
                ) : <>📊 產出審閱報告</>}
            </button>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {result && overallRl && recStyle && (
                <div className="space-y-3 pt-1">
                    {/* Summary strip */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${overallRl.color} ${overallRl.bg} ${overallRl.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${overallRl.dot}`} />
                            整體風險：{overallRl.label}
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${recStyle.color}`}>
                            {recStyle.icon} {recStyle.label}
                        </div>
                        {mustFixCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-300 bg-red-50 text-xs font-semibold text-red-700">
                                🔧 必須修改 {mustFixCount} 項
                            </div>
                        )}
                        <button
                            onClick={() => exportReport(result, contractNumber)}
                            className="ml-auto text-xs px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                        >
                            ↓ 匯出報告
                        </button>
                    </div>

                    {/* Section tabs */}
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                        {SECTION_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setSection(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
                                    section === tab.id ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Section content */}
                    <div className="max-h-[600px] overflow-y-auto pr-1 space-y-3 custom-scrollbar-report">

                        {/* ── Section 1: Risk Summary ── */}
                        {section === 'risk' && (
                            <div className="space-y-3">
                                <div className={`rounded-lg px-4 py-3 border ${overallRl.border} ${overallRl.bg}`}>
                                    <p className={`text-xs font-bold ${overallRl.color} mb-1`}>整體結論</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{result.riskSummary.conclusion}</p>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                                    <span>共 {result.riskSummary.items.length} 項風險</span>
                                    <span className="text-red-600 font-medium">必須修改 {mustFixCount} 項</span>
                                    <span className="text-blue-600 font-medium">可接受 {result.riskSummary.items.length - mustFixCount} 項</span>
                                </div>
                                {result.riskSummary.items.map(item => <RiskCard key={item.id} item={item} />)}
                            </div>
                        )}

                        {/* ── Section 2: Internal Explanation ── */}
                        {section === 'internal' && (
                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
                                    <p className="text-xs font-bold text-gray-700 mb-1">📝 摘要說明</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{result.internalExplanation.summary}</p>
                                </div>

                                <Section title="重點條列">
                                    <BulletList items={result.internalExplanation.keyPoints} />
                                </Section>

                                <Section title="修訂建議">
                                    <BulletList items={result.internalExplanation.revisionSuggestions} color="text-amber-700" />
                                </Section>

                                <Section title="注意事項">
                                    <BulletList items={result.internalExplanation.riskReminders} color="text-red-600" />
                                </Section>
                            </div>
                        )}

                        {/* ── Section 3: Signing Recommendation ── */}
                        {section === 'signing' && (
                            <div className="space-y-3">
                                <div className={`rounded-lg px-4 py-3 border flex items-center gap-3 ${recStyle.banner}`}>
                                    <span className="text-2xl">{recStyle.icon}</span>
                                    <div>
                                        <p className={`text-sm font-bold ${recStyle.color}`}>{recStyle.label}</p>
                                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{result.signingRecommendation.rationale}</p>
                                    </div>
                                </div>

                                {result.signingRecommendation.unacceptableRisks.length > 0 && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                        <p className="text-xs font-bold text-red-700 mb-2">❌ 不可接受風險（需解決後方可簽署）</p>
                                        <BulletList items={result.signingRecommendation.unacceptableRisks} color="text-red-700" />
                                    </div>
                                )}

                                {result.signingRecommendation.requiredModifications.length > 0 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-xs font-bold text-amber-700 mb-2">🔧 必要修正項目</p>
                                        <BulletList items={result.signingRecommendation.requiredModifications} color="text-amber-700" />
                                    </div>
                                )}

                                {result.signingRecommendation.acceptableRisks.length > 0 && (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                        <p className="text-xs font-bold text-blue-700 mb-2">✅ 可接受風險</p>
                                        <BulletList items={result.signingRecommendation.acceptableRisks} color="text-blue-700" />
                                    </div>
                                )}

                                {result.signingRecommendation.commercialBenefits.length > 0 && (
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                        <p className="text-xs font-bold text-green-700 mb-2">💼 商業利益考量</p>
                                        <BulletList items={result.signingRecommendation.commercialBenefits} color="text-green-700" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <style jsx>{`
                        .custom-scrollbar-report::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar-report::-webkit-scrollbar-track { background: #fff1f2; border-radius: 4px; }
                        .custom-scrollbar-report::-webkit-scrollbar-thumb { background: #fda4af; border-radius: 4px; }
                        .custom-scrollbar-report::-webkit-scrollbar-thumb:hover { background: #fb7185; }
                    `}</style>
                </div>
            )}
        </div>
    );
}
