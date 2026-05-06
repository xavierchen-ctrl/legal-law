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
const CHECK_STATUS_ICON: Record<CheckStatus, string> = {
    PASS: '✅', FAIL: '❌', WARN: '⚠️', UNKNOWN: '❓',
};

function GcisModal({ onClose }: { onClose: () => void }) {
    const [companyName, setCompanyName] = useState('');
    const [businessNo, setBusinessNo]   = useState('');
    const [loading, setLoading]          = useState(false);
    const [result, setResult]            = useState<GcisVerifyResult | null>(null);
    const [error, setError]              = useState<string | null>(null);

    const handleVerify = async () => {
        if (!companyName && !businessNo) return;
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

    const failCount = result?.checks.filter(c => c.status === 'FAIL').length ?? 0;
    const warnCount = result?.checks.filter(c => c.status === 'WARN').length ?? 0;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center gap-3 p-6 border-b">
                    <span className="text-2xl">🏢</span>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">商工資料比對</h2>
                        <p className="text-xs text-gray-500">查詢全國商工行政資料開放平臺</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Inputs */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">公司名稱</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="例：台灣某某股份有限公司"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">統一編號（選填，8碼）</label>
                        <input
                            type="text"
                            maxLength={8}
                            value={businessNo}
                            onChange={e => setBusinessNo(e.target.value.replace(/\D/g, ''))}
                            placeholder="例：12345678"
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                        />
                    </div>

                    {/* Verify Button */}
                    <button
                        id="gcis-modal-verify-btn"
                        onClick={handleVerify}
                        disabled={loading || (!companyName && !businessNo)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white
                            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                            disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {loading ? (
                            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> 查詢中...</>
                        ) : '🔍 執行商工比對'}
                    </button>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-3 pt-1">
                            {/* Summary */}
                            <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
                                failCount > 0 ? 'bg-red-50 border-red-200' :
                                warnCount > 0 ? 'bg-yellow-50 border-yellow-200' :
                                'bg-green-50 border-green-200'
                            }`}>
                                <span className="text-xl">{failCount > 0 ? '❌' : warnCount > 0 ? '⚠️' : '✅'}</span>
                                <div>
                                    <div className={`text-sm font-bold ${failCount > 0 ? 'text-red-700' : warnCount > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                                        {failCount > 0 ? `發現 ${failCount} 項不通過，需人工確認` :
                                         warnCount > 0 ? `通過基本核查，${warnCount} 項需注意` :
                                         '所有核查項目通過'}
                                    </div>
                                    {result.companyData && (
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {result.companyData.Company_Name}
                                            {result.companyData.Company_Status_Desc && (
                                                <> ｜ {result.companyData.Company_Status_Desc}</>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Checks */}
                            <div className="space-y-2">
                                {result.checks.map(check => (
                                    <div key={check.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span>{CHECK_STATUS_ICON[check.status]}</span>
                                            <span className="text-sm font-medium text-gray-700">{check.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 pl-6 leading-relaxed">{check.detail}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs text-gray-400">{result.queriedAt}</span>
                                <a href={result.gcisLink} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline">
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
    const [badges, setBadges]   = useState<{ icon: string; label: string; ok: boolean }[] | null>(null);

    const runVerify = async () => {
        if (!name && !no) return;
        setLoading(true);
        setBadges(null);
        try {
            const res  = await fetch('/api/gcis-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: name, businessNo: no }),
            });
            const data = await res.json();
            const iconMap: Record<string, string> = { PASS: '✅', FAIL: '❌', WARN: '⚠️', UNKNOWN: '❓' };
            setBadges(data.checks?.map((c: any) => ({
                icon: iconMap[c.status] ?? '❓',
                label: c.title,
                ok: c.status === 'PASS',
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
        <div className="space-y-2 min-w-[200px]">
            <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="公司名稱"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
                type="text"
                maxLength={8}
                value={no}
                onChange={e => setNo(e.target.value.replace(/\D/g, ''))}
                placeholder="統一編號（選填）"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex gap-1">
                <button
                    onClick={runVerify}
                    disabled={loading || (!name && !no)}
                    className="flex-1 text-xs px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? '查詢...' : '查詢'}
                </button>
                <button
                    onClick={() => { setOpen(false); setBadges(null); }}
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
