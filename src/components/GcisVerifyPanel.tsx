'use client';

import { useState } from 'react';
import type { GcisVerifyResult, GcisCheckItem, CheckStatus } from '@/lib/gcis-service';
import LoadingModal from './LoadingModal';

interface Props {
    companyName: string;
    businessNo?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { icon: string; label: string; bg: string; border: string; text: string }> = {
    PASS:    { icon: '✅', label: '通過',   bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
    FAIL:    { icon: '❌', label: '未通過', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
    WARN:    { icon: '⚠️', label: '注意',   bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    UNKNOWN: { icon: '❓', label: '無資料', bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500'   },
};

// 區分「資料查詢結果」vs「系統提醒」
const ITEM_CATEGORY: Record<number, '資料查詢' | 'AI提醒'> = {
    1: '資料查詢',
    2: '資料查詢',
    3: 'AI提醒',
    4: 'AI提醒',
};

function CheckItemCard({ item }: { item: GcisCheckItem }) {
    const cfg = STATUS_CONFIG[item.status];
    const category = ITEM_CATEGORY[item.id];
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
            <div className="pl-6 mt-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    category === '資料查詢'
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : 'bg-orange-50 text-orange-600 border border-orange-100'
                }`}>
                    {category === '資料查詢' ? '📋 資料查詢結果' : '💡 系統提醒'}
                </span>
            </div>
        </div>
    );
}

export default function GcisVerifyPanel({ companyName, businessNo: initialBusinessNo }: Props) {
    const [businessNo, setBusinessNo] = useState(initialBusinessNo ?? '');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GcisVerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoFoundNo, setAutoFoundNo] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard not available — silently ignore
        }
    };

    const handleVerify = async () => {
        if (!businessNo.trim()) {
            setError('請填入統一編號（8碼數字）');
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

            let data: any;
            try {
                data = await res.json();
            } catch {
                throw new Error('伺服器回應異常，請稍後再試（可能為查詢逾時）');
            }

            if (!res.ok) throw new Error(data?.error ?? '查詢失敗');
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

    const failCount    = result?.checks.filter(c => c.status === 'FAIL').length    ?? 0;
    const warnCount    = result?.checks.filter(c => c.status === 'WARN').length    ?? 0;
    const unknownCount = result?.checks.filter(c => c.status === 'UNKNOWN').length ?? 0;

    return (
        <div className="card p-6 space-y-4">
            <LoadingModal
                open={loading}
                title="商工資料查詢中..."
                message="正在查詢經濟部商工登記資料，請稍候"
            />

            {/* Header */}
            <div className="flex items-center gap-2 border-b pb-3">
                <span className="text-lg">🏢</span>
                <h3 className="text-base font-semibold text-gray-800">商工資料比對</h3>
                <span className="ml-auto text-xs text-gray-400">全國商工服務入口網</span>
            </div>

            {/* 查詢邏輯說明 */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed space-y-1">
                <div className="font-semibold mb-1">📌 查詢邏輯說明</div>
                <div>• <span className="font-medium">統一編號（必填）</span>：系統以統一編號查詢商工登記資料，確保比對準確。</div>
                <div>• 若查無資料，請確認統一編號是否正確，或改至財政部稅籍查詢（獨資商號、行號適用）。</div>
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
                    <span className="ml-1 text-red-500 font-medium">*</span>
                    <span className="ml-1 text-gray-400">（必填，8碼數字）</span>
                </label>
                <input
                    type="text"
                    maxLength={8}
                    value={businessNo}
                    onChange={e => { setBusinessNo(e.target.value.replace(/\D/g, '')); setAutoFoundNo(null); }}
                    placeholder="請輸入8碼統一編號"
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

            {/* 非公司組織提示 */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 leading-relaxed">
                ⚠️ 本系統目前僅查詢<span className="font-medium">經濟部商工登記資料</span>，尚未串接財政部稅籍資料。
                獨資商號、行號、工作室、非法人組織等型態之相對人可能查無資料，不代表主體不存在。
            </div>

            {/* Verify Button */}
            <button
                id="gcis-verify-btn"
                onClick={handleVerify}
                disabled={loading || !businessNo.trim()}
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
                    <div className={`rounded-lg px-4 py-3 flex items-center gap-3 border ${
                        failCount > 0       ? 'bg-red-50 border-red-200'
                        : unknownCount > 0  ? 'bg-gray-50 border-gray-200'
                        : warnCount > 0     ? 'bg-yellow-50 border-yellow-200'
                                            : 'bg-green-50 border-green-200'
                    }`}>
                        <span className="text-xl">
                            {failCount > 0 ? '❌' : unknownCount > 0 ? '❓' : warnCount > 0 ? '⚠️' : '✅'}
                        </span>
                        <div className="flex-1">
                            <div className={`text-sm font-bold ${
                                failCount > 0       ? 'text-red-700'
                                : unknownCount > 0  ? 'text-gray-600'
                                : warnCount > 0     ? 'text-yellow-700'
                                                    : 'text-green-700'
                            }`}>
                                {failCount > 0
                                    ? `發現 ${failCount} 項不通過，需人工確認`
                                    : unknownCount > 0
                                        ? '查無商工資料，請確認公司名稱或手動輸入統一編號'
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

                    {/* 財政部稅籍跳轉區（查無商工資料時才顯示） */}
                    {!result.queried && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-3">
                            <div className="flex items-start gap-2">
                                <span className="text-lg leading-tight">🔎</span>
                                <div>
                                    <div className="text-sm font-semibold text-amber-800">查無商工登記資料</div>
                                    <div className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                        若相對人為獨資商號、行號、工作室等非公司組織，商工資料庫不會有登記記錄。
                                        可改至<span className="font-medium">財政部稅籍資料</span>查詢，複製下方查詢詞後貼入查詢欄位即可。
                                    </div>
                                </div>
                            </div>

                            {/* 複製查詢詞 */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-white border border-amber-200 rounded-md px-3 py-1.5 text-xs font-mono text-gray-700 truncate select-all">
                                    {businessNo.trim() || companyName}
                                </div>
                                <button
                                    onClick={() => handleCopy(businessNo.trim() || companyName)}
                                    className="shrink-0 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md border border-amber-300 transition-colors font-medium"
                                >
                                    {copied ? '✅ 已複製' : '📋 複製查詢詞'}
                                </button>
                            </div>

                            {/* 一鍵跳轉按鈕 */}
                            <a
                                href="https://www.etax.nat.gov.tw/etwmain/etw113w1/ban/query"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                            >
                                🔗 前往財政部稅籍查詢
                            </a>
                            <div className="text-xs text-amber-600 text-center">
                                步驟：複製查詢詞 → 點擊上方連結 → 貼入統一編號或名稱欄位 → 查詢
                            </div>
                        </div>
                    )}

                    {/* 4 check items */}
                    <div className="space-y-2">
                        {result.checks.map(check => (
                            <CheckItemCard key={check.id} item={check} />
                        ))}
                    </div>

                    {/* 免責說明 */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 leading-relaxed space-y-1">
                        <div className="font-semibold text-gray-600">📋 結果說明</div>
                        <div>• <span className="font-medium text-blue-600">資料查詢結果</span>（項目 1、2）：反映商工登記資料現況，為客觀查核比對。</div>
                        <div>• <span className="font-medium text-orange-600">系統提醒</span>（項目 3、4）：為系統依規則自動提示，需結合案件背景由相關人員判斷，不代表已確認風險。</div>
                        <div>• 本查詢結果<span className="font-medium">非正式法律意見</span>，不代表系統已完成完整法律審查或交易主體確認。</div>
                    </div>

                    {/* Footer */}
                    <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between">
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
                        <div className="text-xs text-gray-400">
                            資料來源：
                            <a
                                href="https://data.gcis.nat.gov.tw/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                            >
                                經濟部商工登記資料（data.gcis.nat.gov.tw）
                            </a>
                            ｜比對欄位：公司名稱、統一編號、公司狀態
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400">未串接財政部稅籍（獨資商號、行號適用）：</span>
                            <a
                                href="https://www.etax.nat.gov.tw/etwmain/etw113w1/ban/query"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-200 transition-colors"
                            >
                                🔗 前往財政部稅籍查詢
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
