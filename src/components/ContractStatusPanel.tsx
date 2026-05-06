'use client';

import { useState, useEffect, useCallback } from 'react';

type TrackingStatus = 'REVIEWING' | 'REPLIED' | 'PENDING_STAMP' | 'ARCHIVED';

interface ArchiveEmail {
    name: string;
    email: string;
}

interface TrackingData {
    trackingStatus: TrackingStatus;
    reviewingAt: string | null;
    repliedAt: string | null;
    stampRequestedAt: string | null;
    archivedAt: string | null;
    archiveNotifyEmails: string | null;
}

const STATUS_ORDER: TrackingStatus[] = ['REVIEWING', 'REPLIED', 'PENDING_STAMP', 'ARCHIVED'];

function sheetStatusToTracking(sheetStatus: string, isArchived: boolean, stampCompleted: boolean, stampInProgress: boolean): TrackingStatus {
    if (isArchived || stampCompleted || sheetStatus === 'CLOSED') return 'ARCHIVED';
    if (stampInProgress) return 'PENDING_STAMP';
    if (sheetStatus === 'AWAITING_FEEDBACK') return 'REPLIED';
    return 'REVIEWING';
}

const STATUS_CONFIG: Record<TrackingStatus, { label: string; next: TrackingStatus | null; nextLabel: string | null }> = {
    REVIEWING:     { label: '審閱中', next: 'REPLIED',       nextLabel: '標記為已回覆' },
    REPLIED:       { label: '已回覆', next: 'PENDING_STAMP', nextLabel: '標記為待用印' },
    PENDING_STAMP: { label: '待用印', next: 'ARCHIVED',      nextLabel: '標記為已歸檔' },
    ARCHIVED:      { label: '已歸檔', next: null,            nextLabel: null },
};

const TIMESTAMP_LABELS: Record<string, string> = {
    reviewingAt:       '進入審閱',
    repliedAt:         '已回覆',
    stampRequestedAt:  '待用印',
    archivedAt:        '已歸檔',
};

const DEFAULT_TRACKING: TrackingData = {
    trackingStatus: 'REVIEWING',
    reviewingAt: null,
    repliedAt: null,
    stampRequestedAt: null,
    archivedAt: null,
    archiveNotifyEmails: null,
};

function formatDate(iso: string | null): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function parseEmails(raw: string | null): ArchiveEmail[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

export default function ContractStatusPanel({
    contractId,
    sheetStatus = '',
    isArchived = false,
    stampCompleted = false,
    stampInProgress = false,
}: {
    contractId: string;
    sheetStatus?: string;
    isArchived?: boolean;
    stampCompleted?: boolean;
    stampInProgress?: boolean;
}) {
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [synced, setSynced] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [emailError, setEmailError] = useState('');

    const apiUrl = `/api/contracts/${encodeURIComponent(contractId)}/tracking`;

    const fetchTracking = useCallback(async () => {
        try {
            const res = await fetch(apiUrl);
            const data: TrackingData = res.ok ? (await res.json() ?? DEFAULT_TRACKING) : DEFAULT_TRACKING;

            // 自動同步 Sheet 狀態：若 Sheet 進度比 DB 更前面，自動更新
            const sheetTarget = sheetStatusToTracking(sheetStatus, isArchived, stampCompleted, stampInProgress);
            const sheetIdx = STATUS_ORDER.indexOf(sheetTarget);
            const dbIdx = STATUS_ORDER.indexOf(data.trackingStatus);

            if (sheetIdx > dbIdx) {
                const now = new Date().toISOString();
                const patch: Partial<TrackingData> = { trackingStatus: sheetTarget };
                if (sheetIdx >= 1 && !data.repliedAt)       patch.repliedAt = now;
                if (sheetIdx >= 2 && !data.stampRequestedAt) patch.stampRequestedAt = now;
                if (sheetIdx >= 3 && !data.archivedAt)       patch.archivedAt = now;

                const syncRes = await fetch(apiUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                });
                if (syncRes.ok) {
                    setTracking(await syncRes.json());
                    setSynced(true);
                    return;
                }
            }

            setTracking(data);
        } catch {
            setTracking(DEFAULT_TRACKING);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, sheetStatus, isArchived]);

    useEffect(() => { fetchTracking(); }, [fetchTracking]);

    const patchTracking = async (payload: Partial<TrackingData>) => {
        const res = await fetch(apiUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('更新失敗');
        return res.json() as Promise<TrackingData>;
    };

    const advanceStatus = async () => {
        if (!tracking) return;
        const { next, nextLabel } = STATUS_CONFIG[tracking.trackingStatus];
        if (!next) return;
        if (!confirm(`確定將狀態更新為「${STATUS_CONFIG[next].label}」嗎？`)) return;

        setUpdating(true);
        try {
            const now = new Date().toISOString();
            const patch: Partial<TrackingData> = { trackingStatus: next };
            if (next === 'REPLIED')       patch.repliedAt = now;
            if (next === 'PENDING_STAMP') patch.stampRequestedAt = now;
            if (next === 'ARCHIVED')      patch.archivedAt = now;
            setTracking(await patchTracking(patch));
        } catch {
            alert('更新失敗，請重試');
        } finally {
            setUpdating(false);
        }
    };

    const addEmail = async () => {
        setEmailError('');
        if (!newEmail.trim()) { setEmailError('請輸入 Email'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('Email 格式不正確'); return; }

        const current = parseEmails(tracking?.archiveNotifyEmails ?? null);
        if (current.some(e => e.email === newEmail.trim())) { setEmailError('此 Email 已存在'); return; }

        const updated = [...current, { name: newName.trim(), email: newEmail.trim() }];
        try {
            setTracking(await patchTracking({ archiveNotifyEmails: JSON.stringify(updated) }));
            setNewName('');
            setNewEmail('');
        } catch {
            alert('新增失敗，請重試');
        }
    };

    const removeEmail = async (idx: number) => {
        const updated = parseEmails(tracking?.archiveNotifyEmails ?? null).filter((_, i) => i !== idx);
        try {
            setTracking(await patchTracking({ archiveNotifyEmails: JSON.stringify(updated) }));
        } catch {
            alert('移除失敗，請重試');
        }
    };

    if (loading) {
        return (
            <div className="card p-6">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-8 bg-gray-100 rounded" />
                    <div className="h-8 bg-gray-100 rounded" />
                </div>
            </div>
        );
    }

    const current = tracking ?? DEFAULT_TRACKING;
    const currentIdx = STATUS_ORDER.indexOf(current.trackingStatus);
    const config = STATUS_CONFIG[current.trackingStatus];
    const emails = parseEmails(current.archiveNotifyEmails);
    const showEmailSection = current.trackingStatus !== 'REVIEWING';

    const timestamps: { key: string; label: string; value: string | null }[] = [
        { key: 'reviewingAt',      label: TIMESTAMP_LABELS.reviewingAt,      value: formatDate(current.reviewingAt) },
        { key: 'repliedAt',        label: TIMESTAMP_LABELS.repliedAt,        value: formatDate(current.repliedAt) },
        { key: 'stampRequestedAt', label: TIMESTAMP_LABELS.stampRequestedAt, value: formatDate(current.stampRequestedAt) },
        { key: 'archivedAt',       label: TIMESTAMP_LABELS.archivedAt,       value: formatDate(current.archivedAt) },
    ].filter(t => t.value);

    return (
        <div className="card p-6">
            <div className="flex items-center gap-2 mb-5 border-b pb-2">
                <h3 className="text-lg font-semibold">進度追蹤</h3>
                {synced && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                        ↑ 已從試算表同步
                    </span>
                )}
            </div>

            {/* ── 進度條 ── */}
            <div className="flex items-start mb-6">
                {STATUS_ORDER.map((status, idx) => {
                    const done = idx < currentIdx;
                    const active = idx === currentIdx;
                    const { label } = STATUS_CONFIG[status];
                    return (
                        <div key={status} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                                    done   ? 'bg-green-500 border-green-500 text-white' :
                                    active ? 'bg-blue-600 border-blue-600 text-white' :
                                             'bg-white border-gray-300 text-gray-400'
                                }`}>
                                    {done ? '✓' : idx + 1}
                                </div>
                                <span className={`text-xs whitespace-nowrap font-medium ${
                                    active ? 'text-blue-600' :
                                    done   ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                    {label}
                                </span>
                            </div>
                            {idx < STATUS_ORDER.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 mt-[-12px] transition-colors ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── 時間紀錄 ── */}
            {timestamps.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-5 text-sm bg-gray-50 rounded-lg p-3">
                    {timestamps.map(({ key, label, value }) => (
                        <div key={key} className="flex gap-1">
                            <span className="text-gray-500 shrink-0">{label}：</span>
                            <span className="text-gray-700">{value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── 操作按鈕 ── */}
            {config.next ? (
                <button
                    onClick={advanceStatus}
                    disabled={updating}
                    className="btn btn-primary w-full mb-5"
                >
                    {updating ? '更新中…' : config.nextLabel}
                </button>
            ) : (
                <div className="flex items-center justify-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm mb-5">
                    <span className="text-base">✓</span>
                    此合約已完成歸檔
                </div>
            )}

            {/* ── 歸檔通知名單 ── */}
            {showEmailSection && (
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-1">歸檔通知對象</h4>
                    <p className="text-xs text-gray-500 mb-3">
                        進入「待用印」狀態 7 天後若未歸檔，系統自動發送提醒至以下信箱
                    </p>

                    {/* 現有名單 */}
                    {emails.length > 0 ? (
                        <div className="space-y-1 mb-3">
                            {emails.map((e, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <span className="text-sm flex-1 truncate">
                                        {e.name ? (
                                            <><span className="font-medium">{e.name}</span>
                                            <span className="text-gray-400 ml-1">&lt;{e.email}&gt;</span></>
                                        ) : e.email}
                                    </span>
                                    <button
                                        onClick={() => removeEmail(idx)}
                                        className="text-xs text-red-400 hover:text-red-600 shrink-0"
                                    >
                                        移除
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 mb-3 italic">尚未設定通知對象</div>
                    )}

                    {/* 新增表單 */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="姓名（選填）"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                            type="email"
                            placeholder="email@company.com"
                            value={newEmail}
                            onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                            onKeyDown={e => e.key === 'Enter' && addEmail()}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button onClick={addEmail} className="btn btn-primary text-sm px-4">
                            新增
                        </button>
                    </div>
                    {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                </div>
            )}
        </div>
    );
}
