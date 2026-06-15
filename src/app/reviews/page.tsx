'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { GcisVerifyResult, CheckStatus } from '@/lib/gcis-service';

interface ReviewItem {
    fileId: string;
    fileName: string;
    scannedAt: string;
    matches: string;
    link: string;
    status: 'Unreviewed' | 'In Review' | 'Reviewed';
}

// ─── Inline GCIS Quick-Verify Modal ─────────────────────────────────────────
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
                {/* Modal Header */}
                <div className="flex items-center gap-3 p-6 border-b">
                    <span className="text-2xl">🏢</span>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">商工資料比對</h2>
                        <p className="text-xs text-gray-500">全國商工服務入口網</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none p-1 rounded-full hover:bg-gray-100 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    {/* 查詢邏輯說明 */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed space-y-1">
                        <div className="font-semibold mb-1">📌 查詢邏輯說明</div>
                        <div>• <span className="font-medium">統一編號（必填）</span>：系統以統一編號查詢商工登記資料，確保比對準確。</div>
                        <div>• 若查無資料，請確認統一編號是否正確，或改至財政部稅籍查詢（獨資商號、行號適用）。</div>
                    </div>

                    {/* Inputs */}
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
                            onChange={e => { setBusinessNo(e.target.value.replace(/\D/g, '')); }}
                            placeholder="例：12345678"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                        />
                    </div>

                    {/* 非公司組織提示 */}
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 leading-relaxed">
                        ⚠️ 本系統目前僅查詢<span className="font-medium">經濟部商工登記資料</span>，尚未串接財政部稅籍資料。
                        獨資商號、行號、工作室等型態可能查無資料，不代表主體不存在。
                    </div>

                    {/* Verify Button */}
                    <button
                        id="gcis-modal-verify-btn"
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

                    {/* Results */}
                    {result && (
                        <div className="space-y-3 pt-1">
                            {/* Summary banner */}
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

                            {/* 財政部稅籍跳轉（查無商工資料時才顯示） */}
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

                            {/* Checks */}
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

                            {/* 免責說明 */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 leading-relaxed space-y-1">
                                <div className="font-semibold text-gray-600">📋 結果說明</div>
                                <div>• <span className="font-medium text-blue-600">資料查詢結果</span>（項目 1、2）：反映商工登記資料現況，為客觀查核比對。</div>
                                <div>• <span className="font-medium text-orange-600">系統提醒</span>（項目 3、4）：為系統依規則自動提示，需結合案件背景由相關人員判斷。</div>
                                <div>• 本查詢結果<span className="font-medium">非正式法律意見</span>。</div>
                            </div>

                            {/* Footer */}
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

// ─── Main Reviews Page ───────────────────────────────────────────────────────
export default function ReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Unreviewed' | 'In Review' | 'Reviewed'>('Unreviewed');
    const [gcisModalOpen, setGcisModalOpen] = useState(false);

    useEffect(() => {
        fetch('/api/reviews')
            .then(res => res.json())
            .then(data => {
                setReviews(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleStatusChange = async (fileId: string, newStatus: string) => {
        setReviews(prev => prev.map(r =>
            r.fileId === fileId ? { ...r, status: newStatus as any } : r
        ));
        try {
            await fetch('/api/reviews', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, status: newStatus })
            });
        } catch (error) {
            console.error('Failed to update status', error);
            alert('Status update failed');
        }
    };

    const filteredReviews = reviews.filter(r => {
        if (filter === 'All') return true;
        return r.status === filter;
    });

    const stats = {
        unreviewed: reviews.filter(r => r.status === 'Unreviewed').length,
        inReview:   reviews.filter(r => r.status === 'In Review').length,
        reviewed:   reviews.filter(r => r.status === 'Reviewed').length
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">⚖️ 智慧審閱結果儀表板</h1>
                    <p className="text-gray-500 mt-2">檢視 AI 與關鍵字掃描結果，並追蹤審閱進度。</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* GCIS Quick Verify Button */}
                    <button
                        id="gcis-quick-verify-btn"
                        onClick={() => setGcisModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                        🏢 商工比對
                    </button>
                    <Link href="/" className="text-blue-600 hover:underline">
                        ← 返回主控台
                    </Link>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div onClick={() => setFilter('Unreviewed')} className={`cursor-pointer p-6 rounded-lg border shadow-sm transition-all ${filter === 'Unreviewed' ? 'ring-2 ring-red-500 bg-red-50' : 'bg-white hover:shadow-md'}`}>
                    <div className="text-3xl font-bold text-red-600">{stats.unreviewed}</div>
                    <div className="text-gray-600">🔴 待審閱 (Unreviewed)</div>
                </div>
                <div onClick={() => setFilter('In Review')} className={`cursor-pointer p-6 rounded-lg border shadow-sm transition-all ${filter === 'In Review' ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'bg-white hover:shadow-md'}`}>
                    <div className="text-3xl font-bold text-yellow-600">{stats.inReview}</div>
                    <div className="text-gray-600">🟡 審閱中 (In Review)</div>
                </div>
                <div onClick={() => setFilter('Reviewed')} className={`cursor-pointer p-6 rounded-lg border shadow-sm transition-all ${filter === 'Reviewed' ? 'ring-2 ring-green-500 bg-green-50' : 'bg-white hover:shadow-md'}`}>
                    <div className="text-3xl font-bold text-green-600">{stats.reviewed}</div>
                    <div className="text-gray-600">🟢 已完成 (Reviewed)</div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <div className="border-b border-gray-200 px-6 py-4 flex gap-4">
                    {['All', 'Unreviewed', 'In Review', 'Reviewed'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === f
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {f === 'All' ? '全部' : f}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">載入中...</div>
                ) : filteredReviews.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">此篩選條件下沒有資料 🎉</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">掃描時間</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">檔案名稱</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">偵測結果</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商工比對</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作 / 狀態</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredReviews.map((item) => (
                                <tr key={item.fileId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.scannedAt}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        <div className="flex flex-col">
                                            <span>{item.fileName}</span>
                                            {item.link ? (
                                                <a href={item.link} target="_blank" className="text-blue-500 hover:underline text-xs mt-1">
                                                    🔗 開啟合約 (Google Drive)
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400 mt-1">(無連結)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {item.matches.split(',').map((m, i) => (
                                                <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${m.includes('[AI]') ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}`}>
                                                    {m.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {/* Per-row GCIS quick verify button */}
                                        <GcisRowVerify fileName={item.fileName} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <select
                                            value={item.status}
                                            onChange={(e) => handleStatusChange(item.fileId, e.target.value)}
                                            className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                                                item.status === 'Unreviewed' ? 'text-red-600 font-bold bg-red-50' :
                                                item.status === 'In Review'  ? 'text-yellow-600 font-bold bg-yellow-50' :
                                                'text-green-600 font-bold bg-green-50'
                                            }`}
                                        >
                                            <option value="Unreviewed">🔴 待審閱</option>
                                            <option value="In Review">🟡 審閱中</option>
                                            <option value="Reviewed">🟢 已完成</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* GCIS Modal */}
            {gcisModalOpen && <GcisModal onClose={() => setGcisModalOpen(false)} />}
        </div>
    );
}

// ─── Per-row GCIS inline verifier ────────────────────────────────────────────
function GcisRowVerify({ fileName }: { fileName: string }) {
    const [open, setOpen]       = useState(false);
    const [name, setName]       = useState('');
    const [no, setNo]           = useState('');
    const [loading, setLoading] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);
    const [badges, setBadges]   = useState<{ icon: string; label: string }[] | null>(null);

    const runVerify = async () => {
        if (!no.trim()) { setRowError('請填入統一編號（8碼）'); return; }
        setLoading(true);
        setRowError(null);
        setBadges(null);
        try {
            const res  = await fetch('/api/gcis-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: name, businessNo: no.trim() }),
            });
            const data = await res.json();
            const iconMap: Record<string, string> = { PASS: '✅', FAIL: '❌', WARN: '⚠️', UNKNOWN: '❓' };
            setBadges(data.checks?.map((c: any) => ({
                icon: iconMap[c.status] ?? '❓',
                label: c.title,
            })));
        } catch {
            setBadges([]);
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
                🏢 驗證相對人
            </button>
        );
    }

    return (
        <div className="space-y-2 min-w-[220px]">
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="公司名稱（選填）"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
                autoFocus
                type="text"
                maxLength={8}
                value={no}
                onChange={e => { setNo(e.target.value.replace(/\D/g, '')); setRowError(null); }}
                placeholder="統一編號（必填，8碼）"
                className="w-full text-xs border border-blue-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {rowError && <p className="text-xs text-red-500">{rowError}</p>}
            <div className="flex gap-1">
                <button
                    onClick={runVerify}
                    disabled={loading}
                    className="flex-1 text-xs px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? '查詢...' : '查詢'}
                </button>
                <button
                    onClick={() => { setOpen(false); setBadges(null); setRowError(null); }}
                    className="text-xs px-2 py-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                    取消
                </button>
            </div>
            {badges && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {badges.length === 0 ? (
                        <span className="text-xs text-red-500">查詢失敗</span>
                    ) : (
                        badges.map((b, i) => (
                            <span
                                key={i}
                                title={b.label}
                                className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                    b.icon === '✅' ? 'bg-green-50 border-green-200 text-green-700' :
                                    b.icon === '❌' ? 'bg-red-50 border-red-200 text-red-700' :
                                    b.icon === '⚠️' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                    'bg-gray-50 border-gray-200 text-gray-500'
                                }`}
                            >
                                {b.icon}
                            </span>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
