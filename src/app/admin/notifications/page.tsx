'use client';

import { useState, useEffect } from 'react';

interface PendingItem {
    contractNumber: string;
    documentName: string;
    requester: string;
    derivedEmail: string;
    reason: string;
    lastReplyDate: string | null;
    stampCompleted: boolean;
}

export default function ManualNotificationsPage() {
    const [pending, setPending] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState<string | null>(null);
    const [emails, setEmails] = useState<Record<string, { to: string; cc: string }>>({});
    const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

    useEffect(() => {
        fetch('/api/admin/pending-followups')
            .then(r => r.json())
            .then(data => {
                setPending(data.pending ?? []);
                const init: Record<string, { to: string; cc: string }> = {};
                (data.pending ?? []).forEach((item: PendingItem) => {
                    init[item.contractNumber] = { to: '', cc: '' };
                });
                setEmails(init);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSend = async (item: PendingItem) => {
        const { to, cc } = emails[item.contractNumber] ?? {};
        if (!to.trim()) { alert('請輸入收件人 Email'); return; }

        setSending(item.contractNumber);
        try {
            const res = await fetch('/api/admin/send-followup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractNumber: item.contractNumber, toEmail: to.trim(), ccEmail: cc }),
            });
            const data = await res.json();
            setResults(prev => ({
                ...prev,
                [item.contractNumber]: {
                    success: data.success,
                    message: data.success ? `已發送至 ${to}${cc ? ` 及 ${cc}` : ''}` : data.error ?? '發送失敗',
                },
            }));
        } finally {
            setSending(null);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">人工催辦發信</h1>
            <p className="text-sm text-gray-500 mb-6">以下合約的申請人不在系統目錄中，無法自動發信，請人工輸入 Email 後手動發送。</p>

            {loading && <p className="text-gray-400">載入中...</p>}

            {!loading && pending.length === 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-6 py-4 text-green-700 text-sm">
                    ✅ 目前沒有需要人工處理的催辦項目
                </div>
            )}

            <div className="space-y-4">
                {pending.map(item => (
                    <div key={item.contractNumber} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                                <p className="font-bold text-gray-800">{item.contractNumber}</p>
                                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-md">{item.documentName}</p>
                            </div>
                            <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium border ${
                                item.stampCompleted
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                {item.reason}
                            </span>
                        </div>

                        <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                            <p>申請人：<span className="font-medium text-gray-700">{item.requester}</span></p>
                            <p>系統推測 Email：<span className="font-mono text-gray-400">{item.derivedEmail}</span>（不在目錄中）</p>
                        </div>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">收件人 Email *</label>
                                <input
                                    type="email"
                                    placeholder="輸入申請人的正確 Email"
                                    value={emails[item.contractNumber]?.to ?? ''}
                                    onChange={e => setEmails(prev => ({
                                        ...prev,
                                        [item.contractNumber]: { ...prev[item.contractNumber], to: e.target.value }
                                    }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 block mb-1">副本 Email（選填）</label>
                                <input
                                    type="email"
                                    placeholder="主管或其他人"
                                    value={emails[item.contractNumber]?.cc ?? ''}
                                    onChange={e => setEmails(prev => ({
                                        ...prev,
                                        [item.contractNumber]: { ...prev[item.contractNumber], cc: e.target.value }
                                    }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <button
                                onClick={() => handleSend(item)}
                                disabled={sending === item.contractNumber}
                                className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {sending === item.contractNumber ? '發送中...' : '發送'}
                            </button>
                        </div>

                        {results[item.contractNumber] && (
                            <p className={`mt-2 text-xs font-medium ${results[item.contractNumber].success ? 'text-green-600' : 'text-red-500'}`}>
                                {results[item.contractNumber].success ? '✓' : '✗'} {results[item.contractNumber].message}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
