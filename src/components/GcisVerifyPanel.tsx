'use client';

import { useState } from 'react';
import type { GcisVerifyResult, GcisCheckItem, CheckStatus } from '@/lib/gcis-service';
import LoadingModal from './LoadingModal';

interface Props {
    companyName: string;
    businessNo?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { icon: string; label: string; bg: string; border: string; text: string }> = {
    PASS: { icon: '✅', label: '通過', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    FAIL: { icon: '❌', label: '未通過', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    WARN: { icon: '⚠️', label: '注意', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    UNKNOWN: { icon: '❓', label: '無資料', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500' },
};

function CheckItemCard({ item }: { item: GcisCheckItem }) {
    const cfg = STATUS_CONFIG[item.status];
    return (
        <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{cfg.icon}</span>
                <span className={`text-sm font-semibold ${cfg.text}`}>{item.title}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                    {cfg.label}
                </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed pl-6">{item.detail}</p>
        </div>
    );
}

export default function GcisVerifyPanel({ companyName, businessNo: initialBusinessNo }: Props) {
    const [businessNo, setBusinessNo] = useState(initialBusinessNo ?? '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GcisVerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoFoundNo, setAutoFoundNo] = useState<string | null>(null);

    const handleVerify = async () => {
        if (!companyName && !businessNo) {
            setError('請填入公司名稱或統一編號');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        setAutoFoundNo(null);

        try {
            const res = await fetch('/api/gcis-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, businessNo: businessNo.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '查詢失敗');
            setResult(data);

            // 若使用者未填統一編號，但 API 查到了，自動帶入
            const foundNo = data.companyData?.Business_Accounting_NO;
            if (!businessNo.trim() && foundNo) {
                setBusinessNo(foundNo);
                setAutoFoundNo(foundNo);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    const failCount = result?.checks.filter(c => c.status === 'FAIL').length ?? 0;
    const warnCount = result?.checks.filter(c => c.status === 'WARN').length ?? 0;
    const unknownCount = result?.checks.filter(c => c.status === 'UNKNOWN').length ?? 0;

    return (
        <div className="card p-6 space-y-4">
            <LoadingModal
                open={loading}
                title="商工資料查詢中..."
                message="正在查詢全國商工服務入口網，請稍候"
            />
            {/* Header */}
            <div className="flex items-center gap-2 border-b pb-3">
                <span className="text-lg">🏢</span>
                <h3 className="text-base font-semibold text-gray-800">商工資料比對</h3>
                <span className="ml-auto text-xs text-gray-400">全國商工服務入口網</span>
            </div>

            {/* Company Name display */}
            <div>
                <label className="text-xs text-gray-500 block mb-1">合約相對人</label>
                <div className="text-sm font-medium text-gray-800 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    {companyName || <span className="text-gray-400 italic">（未填寫）</span>}
                </div>
            </div>

            {/* Business Number input */}
            <div>
                <label className="text-xs text-gray-500 block mb-1">
                    統一編號
                </label>
                <input
                    type="text"
                    maxLength={8}
                    value={businessNo}
                    onChange={e => { setBusinessNo(e.target.value.replace(/\D/g, '')); setAutoFoundNo(null); }}
                    placeholder="請輸入8碼統一編號（選填）"
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                {autoFoundNo && (
                    <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                        <span className="text-blue-500 text-sm">🔍</span>
                        <span className="text-xs text-blue-700 flex-1">
                            系統依公司名稱自動查得統一編號：<span className="font-mono font-bold">{autoFoundNo}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Verify Button */}
            <button
                id="gcis-verify-btn"
                onClick={handleVerify}
                disabled={loading || (!companyName && !businessNo)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200
                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        查詢中...
                    </>
                ) : (
                    <>🔍 執行商工比對</>
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
                    <div className={`rounded-lg px-4 py-3 flex items-center gap-3 border ${failCount > 0
                            ? 'bg-red-50 border-red-200'
                            : unknownCount > 0
                                ? 'bg-gray-50 border-gray-200'
                                : warnCount > 0
                                    ? 'bg-yellow-50 border-yellow-200'
                                    : 'bg-green-50 border-green-200'
                        }`}>
                        <span className="text-xl">
                            {failCount > 0 ? '❌' : unknownCount > 0 ? '❓' : warnCount > 0 ? '⚠️' : '✅'}
                        </span>
                        <div className="flex-1">
                            <div className={`text-sm font-bold ${failCount > 0 ? 'text-red-700' : unknownCount > 0 ? 'text-gray-600' : warnCount > 0 ? 'text-yellow-700' : 'text-green-700'
                                }`}>
                                {failCount > 0
                                    ? `發現 ${failCount} 項不通過，需人工確認`
                                    : unknownCount > 0
                                        ? `查無商工資料，請確認公司名稱或手動輸入統一編號`
                                        : warnCount > 0
                                            ? `通過基本核查，${warnCount} 項需注意`
                                            : '所有核查項目通過'
                                }
                            </div>
                            {result.companyData && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                    查詢到：{result.companyData.Company_Name}
                                    {result.companyData.Registered_Capital_Amount && (
                                        <> ｜ 資本額 {Number(result.companyData.Registered_Capital_Amount).toLocaleString()} 元</>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4 check items */}
                    <div className="space-y-2">
                        {result.checks.map(check => (
                            <CheckItemCard key={check.id} item={check} />
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-gray-400">查詢時間：{result.queriedAt}</span>
                        <a
                            href={result.gcisLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                            🔗 前往全國商工查詢
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
