'use client';

import { useState } from 'react';
import type {
    PaymentCheckResult,
    PaymentDeviation,
    RiskLevel,
    Recommendation,
    ExtractionSource,
    OurRole,
    ReferenceSourceType,
    ResolvedRole,
} from '@/lib/payment-service';
import LoadingModal from './LoadingModal';
import FileUploadZone from './FileUploadZone';

interface Props {
    documentName?: string;
    contractNumber?: string;
    counterparty?: string;
}

type InputMode = 'text' | 'upload';

const RISK_STYLE: Record<RiskLevel, { label: string; banner: string; icon: string; color: string }> = {
    HIGH:   { label: '高風險', banner: 'border-red-300 bg-red-50',    icon: '🔴', color: 'text-red-700' },
    MEDIUM: { label: '中風險', banner: 'border-amber-300 bg-amber-50', icon: '🟡', color: 'text-amber-700' },
    LOW:    { label: '低風險', banner: 'border-green-300 bg-green-50', icon: '🟢', color: 'text-green-700' },
};

const REC_STYLE: Record<Recommendation, { label: string; color: string; bg: string }> = {
    APPROVE:  { label: '建議同意',     color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
    ESCALATE: { label: '需上級核准',   color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300' },
    REJECT:   { label: '建議拒絕',     color: 'text-red-700',   bg: 'bg-red-100 border-red-300' },
};

const DEV_STYLE: Record<string, { label: string; color: string; bg: string }> = {
    UNFAVORABLE: { label: '不利', color: 'text-red-600',  bg: 'bg-red-50' },
    FAVORABLE:   { label: '有利', color: 'text-green-600', bg: 'bg-green-50' },
    NEUTRAL:     { label: '中性', color: 'text-gray-600',  bg: 'bg-gray-50' },
};

const REF_SOURCE_LABEL: Record<ReferenceSourceType, { label: string; icon: string; color: string }> = {
    USER_HISTORICAL: { label: '使用者提供之過往條件', icon: '📋', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    COMPANY_POLICY:  { label: '使用者提供之公司政策', icon: '📑', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    AI_ESTIMATE:     { label: 'AI 推估（無外部資料）', icon: '🤖', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    NONE:            { label: '無對應參考', icon: '—', color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

const ROLE_LABEL: Record<ResolvedRole, { label: string; icon: string; color: string }> = {
    COLLECTOR: { label: '我方為收款方', icon: '💰', color: 'text-green-700 bg-green-50 border-green-200' },
    PAYER:     { label: '我方為付款方', icon: '💸', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    UNCLEAR:   { label: '角色不明確',   icon: '❓', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

function SourceBadge({ src }: { src: ExtractionSource }) {
    const [open, setOpen] = useState(false);
    if (src.sourceType === 'NOT_FOUND') {
        return <span className="text-xs px-1.5 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-500 font-normal">合約未約定</span>;
    }
    const isQuote = src.sourceType === 'CONTRACT_QUOTE' && src.sourceQuote;
    const badge = src.sourceType === 'CONTRACT_QUOTE'
        ? { icon: '📌', label: src.sourceNote || '條文引述', color: 'text-green-700 bg-green-50 border-green-200' }
        : { icon: '🔗', label: src.sourceNote || '條文推論', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return (
        <div className="inline-block">
            <button
                onClick={() => isQuote && setOpen(v => !v)}
                disabled={!isQuote}
                className={`text-xs px-1.5 py-0.5 rounded border font-medium ${badge.color} ${isQuote ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                title={isQuote ? '點擊展開條文引述' : ''}
            >
                {badge.icon} {badge.label}{isQuote && <span className="ml-1">{open ? '▲' : '▼'}</span>}
            </button>
            {open && isQuote && (
                <div className="mt-1 rounded border border-green-200 bg-white px-2 py-1.5 text-xs text-gray-700 leading-relaxed max-w-md">
                    「{src.sourceQuote}」
                </div>
            )}
        </div>
    );
}

function DeviationRow({ d }: { d: PaymentDeviation }) {
    const ds = DEV_STYLE[d.deviationType] ?? DEV_STYLE.NEUTRAL;
    const refSrc = REF_SOURCE_LABEL[d.referenceSourceType] ?? REF_SOURCE_LABEL.NONE;
    return (
        <div className={`rounded-lg border border-gray-200 ${ds.bg} px-4 py-3 mb-2`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-gray-700">{d.field}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ds.color} ${ds.bg}`}>
                    {ds.label}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-1.5">
                <div className="bg-white rounded p-2 border border-gray-200">
                    <p className="text-xs text-gray-400 mb-0.5">合約條件</p>
                    <p className="text-xs font-medium text-gray-800">{d.currentValue}</p>
                    {d.currentValueSource && (
                        <p className="text-xs text-gray-400 mt-0.5">📌 來源：{d.currentValueSource}</p>
                    )}
                </div>
                <div className="bg-white rounded p-2 border border-gray-200">
                    <p className="text-xs text-gray-400 mb-0.5">參考條件</p>
                    <p className="text-xs font-medium text-gray-800">{d.referenceValue}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${refSrc.color}`}>
                            {refSrc.icon} {refSrc.label}
                        </span>
                    </div>
                    {d.referenceSourceNote && (
                        <p className="text-xs text-gray-500 mt-1 italic leading-relaxed">{d.referenceSourceNote}</p>
                    )}
                </div>
            </div>
            <p className={`text-xs ${ds.color} leading-relaxed`}>{d.riskDescription}</p>
        </div>
    );
}

export default function PaymentCheckPanel({ documentName, contractNumber, counterparty }: Props) {
    const [mode, setMode] = useState<InputMode>('text');
    const [rawText, setRawText] = useState('');
    const [uploadedText, setUploadedText] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [historicalTerms, setHistoricalTerms] = useState('');
    const [companyPolicy, setCompanyPolicy] = useState('');
    const [transactionBackground, setTransactionBackground] = useState('');
    const [counterpartyType, setCounterpartyType] = useState<'existing' | 'new'>('new');
    const [ourRole, setOurRole] = useState<OurRole>('AUTO');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PaymentCheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Confirmation
    const [confirmedBy, setConfirmedBy] = useState('');
    const [requesterEmail, setRequesterEmail] = useState('');
    const [financeEmail, setFinanceEmail] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [confirmResult, setConfirmResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setConfirmResult(null);

        try {
            const textToSend = mode === 'text' ? rawText : uploadedText;
            const body = { rawText: textToSend, historicalTerms, companyPolicy, transactionBackground, counterpartyType, ourRole };

            const res = await fetch('/api/payment-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '分析失敗');
            setResult(data.result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!result || !confirmedBy.trim()) return;
        setConfirming(true);

        try {
            const res = await fetch('/api/payment-confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractNumber: contractNumber ?? '—',
                    documentName: documentName ?? rawText.slice(0, 30),
                    counterparty: counterparty ?? '—',
                    requesterEmail,
                    financeEmail,
                    result,
                    confirmedBy,
                    confirmedAt: new Date().toLocaleString('zh-TW'),
                }),
            });
            const data = await res.json();
            setConfirmResult({ success: res.ok, message: data.message ?? data.error });
        } catch (err: any) {
            setConfirmResult({ success: false, message: err.message });
        } finally {
            setConfirming(false);
        }
    };

    const canSubmit = mode === 'text' ? rawText.trim().length > 20 : uploadedText.length > 20;
    const rs = result ? RISK_STYLE[result.riskLevel] : null;
    const rec = result ? REC_STYLE[result.recommendation] : null;

    return (
        <div className="card p-6 space-y-4 shadow-sm border border-cyan-100 bg-gradient-to-b from-white to-cyan-50/20">
            <LoadingModal
                open={loading}
                title="付款條件比對中..."
                message="AI 正在分析合約付款條款並與歷史條件比對，通常需要 15～30 秒"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-cyan-100 pb-3">
                <span className="text-lg">💳</span>
                <h3 className="text-base font-semibold text-cyan-900">付款條件比對 (AI)</h3>
                <span className="ml-auto text-xs text-cyan-400 font-medium">Payment Terms Check</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                比對合約付款條件是否符合過往交易條件或公司付款政策，標示異常差異，確認後通知需求單位及財務單位。
            </p>

            {/* Counterparty type */}
            <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs font-semibold text-gray-600">相對人類型</p>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button
                        onClick={() => setCounterpartyType('existing')}
                        className={`px-3 py-1.5 transition-colors ${counterpartyType === 'existing' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        既有客戶/廠商
                    </button>
                    <button
                        onClick={() => setCounterpartyType('new')}
                        className={`px-3 py-1.5 transition-colors ${counterpartyType === 'new' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        新客戶/廠商
                    </button>
                </div>
            </div>

            {/* Our role (影響風險方向) */}
            <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs font-semibold text-gray-600">
                    我方角色
                    <span className="ml-1 font-normal text-gray-400">（影響風險方向判讀）</span>
                </p>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    {([
                        { v: 'AUTO',      label: '🤖 AI 自動判斷' },
                        { v: 'COLLECTOR', label: '💰 我方為收款方' },
                        { v: 'PAYER',     label: '💸 我方為付款方' },
                    ] as { v: OurRole; label: string }[]).map(opt => (
                        <button
                            key={opt.v}
                            onClick={() => setOurRole(opt.v)}
                            className={`px-3 py-1.5 transition-colors ${ourRole === opt.v ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed bg-gray-50 border border-gray-200 rounded px-3 py-2">
                💡 收款方：期限縮短／預付提高為「有利」；付款方則相反。若選 AI 自動判斷，系統會嘗試從合約文字判讀，但建議在角色明確時直接指定，避免風險方向誤判。
            </div>

            {/* Input mode */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                    onClick={() => setMode('text')}
                    className={`flex-1 py-2 transition-colors ${mode === 'text' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    貼上付款條款
                </button>
                <button
                    onClick={() => setMode('upload')}
                    className={`flex-1 py-2 transition-colors ${mode === 'upload' ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    上傳檔案
                </button>
            </div>

            {mode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder="請貼上合約中的付款條款內容..."
                    rows={5}
                    className="w-full text-xs border border-cyan-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-300 bg-cyan-50/20 text-gray-800 placeholder-gray-400"
                />
            ) : (
                <>
                    <FileUploadZone
                        accentColor="blue"
                        onTextExtracted={(text) => { setUploadedText(text); setUploadError(null); }}
                        onError={msg => setUploadError(msg)}
                    />
                    {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 leading-relaxed">
                        ⚠️ <span className="font-medium">PDF／Word 解析差異提醒：</span>
                        PDF 與 Word 之文字擷取邏輯不同（特別是表格、特殊符號、排版），可能導致 AI 判讀結果不一致。
                        若同一份內容兩版本結果差異明顯，請以「貼上文字」模式重新比對，或改用條文最完整的版本。
                    </div>
                </>
            )}

            {/* Advanced inputs */}
            <div>
                <button
                    onClick={() => setShowAdvanced(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-800 transition-colors"
                >
                    <span>{showAdvanced ? '▼' : '▶'}</span>
                    參考資料輸入（過往條件 / 公司政策 / 交易背景）
                </button>
                {showAdvanced && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                過往交易付款條件
                                <span className="font-normal text-gray-400 ml-1">（供比對差異用，選填）</span>
                            </label>
                            <textarea
                                value={historicalTerms}
                                onChange={e => setHistoricalTerms(e.target.value)}
                                placeholder="貼上過往與同一廠商/客戶的付款條件，或過去合約相關條款..."
                                rows={3}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-200 bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                公司內部付款政策
                                <span className="font-normal text-gray-400 ml-1">（選填）</span>
                            </label>
                            <textarea
                                value={companyPolicy}
                                onChange={e => setCompanyPolicy(e.target.value)}
                                placeholder="貼上公司財務規範或付款政策，例如：月結最長不超過60天、需收取逾期罰息..."
                                rows={3}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-200 bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                                交易背景說明
                                <span className="font-normal text-gray-400 ml-1">（選填）</span>
                            </label>
                            <textarea
                                value={transactionBackground}
                                onChange={e => setTransactionBackground(e.target.value)}
                                placeholder="需求單位提供的交易說明或特殊背景..."
                                rows={2}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-200 bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Analyze button */}
            <button
                onClick={handleAnalyze}
                disabled={loading || !canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700
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
                ) : <>💳 執行付款條件比對</>}
            </button>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {result && rs && rec && (
                <div className="space-y-3 pt-1">
                    {/* Risk banner */}
                    <div className={`rounded-lg px-4 py-3 border flex items-start gap-3 ${rs.banner}`}>
                        <span className="text-xl mt-0.5">{rs.icon}</span>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <p className={`text-sm font-bold ${rs.color}`}>{rs.label}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${rec.color} ${rec.bg}`}>
                                    {rec.label}
                                </span>
                                {result.approvalLevel && (
                                    <span className="text-xs px-2 py-0.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 font-medium">
                                        核准層級：{result.approvalLevel}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
                        </div>
                    </div>

                    {/* Resolved role + methodology */}
                    {(() => {
                        const role = ROLE_LABEL[result.resolvedRole] ?? ROLE_LABEL.UNCLEAR;
                        return (
                            <div className={`rounded-lg border px-3 py-2.5 ${role.color}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base">{role.icon}</span>
                                    <span className="text-xs font-bold">本次採用角色：{role.label}</span>
                                </div>
                                {result.roleResolution && (
                                    <p className="text-xs mt-1 leading-relaxed opacity-90">判斷依據：{result.roleResolution}</p>
                                )}
                                {result.methodologyNote && (
                                    <p className="text-xs mt-1 leading-relaxed opacity-80 italic">📐 方法論：{result.methodologyNote}</p>
                                )}
                            </div>
                        );
                    })()}

                    {/* Extracted terms with sources */}
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3">
                        <p className="text-xs font-bold text-cyan-700 mb-2">📋 擷取之付款條件（含來源）</p>
                        <div className="space-y-2 text-xs">
                            {[
                                { key: 'paymentPeriod' as const, label: '付款期間', val: result.extractedTerms.paymentPeriod },
                                { key: 'paymentMethod' as const, label: '付款方式', val: result.extractedTerms.paymentMethod },
                                { key: 'paymentMilestones' as const, label: '付款里程碑', val: result.extractedTerms.paymentMilestones.length > 0 ? result.extractedTerms.paymentMilestones.join('　') : '未約定' },
                                { key: 'latePaymentPenalty' as const, label: '逾期罰息', val: result.extractedTerms.latePaymentPenalty ?? '未約定' },
                                { key: 'currency' as const, label: '幣別', val: result.extractedTerms.currency },
                            ].map(row => (
                                <div key={row.key} className="flex gap-2 items-start">
                                    <span className="text-gray-400 shrink-0 w-20">{row.label}</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-gray-800">{row.val}</span>
                                        <div className="mt-0.5">
                                            <SourceBadge src={result.extractionSources[row.key]} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deviations */}
                    {result.deviations.length > 0 ? (
                        <div>
                            <p className="text-xs font-bold text-gray-700 mb-2">⚠️ 差異比對結果（{result.deviations.length} 項）</p>
                            <div className="max-h-[300px] overflow-y-auto pr-1">
                                {result.deviations.map((d, i) => <DeviationRow key={i} d={d} />)}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-700 font-medium">
                            ✅ 付款條件與參考條件一致，無異常差異
                        </div>
                    )}

                    {/* Overall assessment */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-600 mb-1">整體評估</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{result.overallAssessment}</p>
                    </div>

                    {/* Confirmation section */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                        <p className="text-xs font-bold text-blue-700">✅ 確認付款條件並通知相關人員</p>
                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">確認人員姓名 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={confirmedBy}
                                    onChange={e => setConfirmedBy(e.target.value)}
                                    placeholder="請輸入確認人員姓名..."
                                    className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">需求單位 Email</label>
                                    <input
                                        type="email"
                                        value={requesterEmail}
                                        onChange={e => setRequesterEmail(e.target.value)}
                                        placeholder="requester@company.com"
                                        className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">財務單位 Email</label>
                                    <input
                                        type="email"
                                        value={financeEmail}
                                        onChange={e => setFinanceEmail(e.target.value)}
                                        placeholder="finance@company.com"
                                        className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={confirming || !confirmedBy.trim() || !!confirmResult?.success}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all
                                bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700
                                disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    通知發送中...
                                </>
                            ) : confirmResult?.success ? '✅ 已確認完成' : '確認並通知相關人員'}
                        </button>
                        {confirmResult && (
                            <div className={`text-xs rounded px-3 py-2 ${confirmResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                {confirmResult.message}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
