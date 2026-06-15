'use client';

import { useState } from 'react';
import type { GcisVerifyResult, CheckStatus } from '@/lib/gcis-service';

const CHECK_STATUS_CONFIG: Record<CheckStatus, { icon: string; bg: string; border: string; text: string; label: string }> = {
    PASS:    { icon: '✅', label: '通過',   bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
    FAIL:    { icon: '❌', label: '未通過', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
    WARN:    { icon: '⚠️', label: '注意',   bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    UNKNOWN: { icon: '❓', label: '無資料', bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500'   },
};

const ITEM_CATEGORY: Record<number, '資料查詢' | 'AI提醒'> = { 1: '資料查詢', 2: '資料查詢', 3: 'AI提醒', 4: 'AI提醒' };

function GcisModal({ onClose }: { onClose: () => void }) {
    const [companyName, setCompanyName] = useState('');
    const [businessNo, setBusinessNo]   = useState('');
    const [loading, setLoading]          = useState(false);
    const [result, setResult]            = useState<GcisVerifyResult | null>(null);
    const [error, setError]              = useState<string | null>(null);
    const [copied, setCopied]            = useState(false);

    const handleCopy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    };

    const handleVerify = async () => {
        if (!businessNo.trim()) {
            setError('請填入統一編號（8碼數字）');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch('/api/gcis-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, businessNo: businessNo.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '查詢失敗');
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const failCount    = result?.checks.filter(c => c.status === 'FAIL').length    ?? 0;
    const warnCount    = result?.checks.filter(c => c.status === 'WARN').length    ?? 0;
    const unknownCount = result?.checks.filter(c => c.status === 'UNKNOWN').length ?? 0;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 p-6 border-b">
                    <span className="text-2xl">🏢</span>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">商工資料比對</h2>
                        <p className="text-xs text-gray-500">全國商工服務入口網</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none p-1 rounded-full hover:bg-gray-100 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed space-y-1">
                        <div className="font-semibold mb-1">📌 查詢邏輯說明</div>
                        <div>• <span className="font-medium">統一編號（必填）</span>：系統以統一編號查詢商工登記資料，確保比對準確。</div>
                        <div>• 若查無資料，請確認統一編號是否正確，或改至財政部稅籍查詢（獨資商號、行號適用）。</div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">公司名稱<span className="ml-1 text-gray-400">（選填）</span></label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="例：台灣某某股份有限公司"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">
                            統一編號<span className="ml-1 text-red-500 font-medium">*</span>
                            <span className="ml-1 text-gray-400">（必填，8碼數字）</span>
                        </label>
                        <input
                            type="text"
                            maxLength={8}
                            value={businessNo}
                            onChange={e => { setBusinessNo(e.target.value.replace(/\D/g, '')); setError(null); }}
                            placeholder="例：12345678"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                        />
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 leading-relaxed">
                        ⚠️ 本系統目前僅查詢<span className="font-medium">經濟部商工登記資料</span>，尚未串接財政部稅籍資料。
                        獨資商號、行號、工作室等型態可能查無資料，不代表主體不存在。
                    </div>

                    <button
                        onClick={handleVerify}
                        disabled={loading || !businessNo.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white
                            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                            disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {loading ? (
                            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> 查詢中...</>
                        ) : '🔍 執行商工比對'}
                    </button>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</div>
                    )}

                    {result && (
                        <div className="space-y-3 pt-1">
                            <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
                                failCount > 0      ? 'bg-red-50 border-red-200'
                                : unknownCount > 0 ? 'bg-gray-50 border-gray-200'
                                : warnCount > 0    ? 'bg-yellow-50 border-yellow-200'
                                                   : 'bg-green-50 border-green-200'
                            }`}>
                                <span className="text-xl">{failCount > 0 ? '❌' : unknownCount > 0 ? '❓' : warnCount > 0 ? '⚠️' : '✅'}</span>
                                <div className="flex-1">
                                    <div className={`text-sm font-bold ${
                                        failCount > 0      ? 'text-red-700'
                                        : unknownCount > 0 ? 'text-gray-600'
                                        : warnCount > 0    ? 'text-yellow-700'
                                                           : 'text-green-700'
                                    }`}>
                                        {failCount > 0
                                            ? `發現 ${failCount} 項不通過，需人工確認`
                                            : unknownCount > 0
                                                ? '查無商工資料，請確認統一編號或改用財政部稅籍查詢'
                                                : warnCount > 0
                                                    ? `通過基本核查，${warnCount} 項需注意`
                                                    : '所有核查項目通過'}
                                    </div>
                                    {result.companyData && (
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {result.companyData.Company_Name}
                                            {result.companyData.Registered_Capital_Amount && (
                                                <> ｜ 資本額 {Number(result.companyData.Registered_Capital_Amount).toLocaleString()} 元</>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!result.queried && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <span className="text-lg leading-tight">🔎</span>
                                        <div>
                                            <div className="text-sm font-semibold text-amber-800">查無商工登記資料</div>
                                            <div className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                                若相對人為獨資商號、行號、工作室等非公司組織，可改至財政部稅籍查詢。複製下方查詢詞後貼入即可。
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-white border border-amber-200 rounded-md px-3 py-1.5 text-xs font-mono text-gray-700 truncate">
                                            {businessNo.trim() || companyName}
                                        </div>
                                        <button
                                            onClick={() => handleCopy(businessNo.trim() || companyName)}
                                            className="shrink-0 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md border border-amber-300 transition-colors font-medium"
                                        >
                                            {copied ? '✅ 已複製' : '📋 複製'}
                                        </button>
                                    </div>
                                    <a
                                        href="https://www.etax.nat.gov.tw/etwmain/etw113w1/ban/query"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        🔗 前往財政部稅籍查詢
                                    </a>
                                </div>
                            )}

                            <div className="space-y-2">
                                {result.checks.map(check => {
                                    const cfg = CHECK_STATUS_CONFIG[check.status];
                                    const cat = ITEM_CATEGORY[check.id];
                                    return (
                                        <div key={check.id} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-base">{cfg.icon}</span>
                                                <span className={`text-sm font-semibold ${cfg.text}`}>{check.title}</span>
                                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 pl-6 leading-relaxed">{check.detail}</p>
                                            <div className="pl-6 mt-1.5">
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                                    cat === '資料查詢'
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                        : 'bg-orange-50 text-orange-600 border border-orange-100'
                                                }`}>
                                                    {cat === '資料查詢' ? '📋 資料查詢結果' : '💡 系統提醒'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 leading-relaxed space-y-1">
                                <div className="font-semibold text-gray-600">📋 結果說明</div>
                                <div>• <span className="font-medium text-blue-600">資料查詢結果</span>（項目 1、2）：反映商工登記資料現況，為客觀查核比對。</div>
                                <div>• <span className="font-medium text-orange-600">系統提醒</span>（項目 3、4）：為系統依規則自動提示，需結合案件背景由相關人員判斷。</div>
                                <div>• 本查詢結果<span className="font-medium">非正式法律意見</span>。</div>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs text-gray-400">查詢時間：{result.queriedAt}</span>
                                <a href={result.gcisLink} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                    🔗 前往全國商工查詢
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function GcisModalButton() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
                🏢 商工比對
            </button>
            {open && <GcisModal onClose={() => setOpen(false)} />}
        </>
    );
}
