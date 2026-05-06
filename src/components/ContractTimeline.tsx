'use client';

import { useState, useEffect, useCallback } from 'react';
import { differenceInCalendarDays } from 'date-fns';

type TrackingStatus = 'REVIEWING' | 'REPLIED' | 'PENDING_STAMP' | 'ARCHIVED';

interface TrackingData {
    trackingStatus: TrackingStatus;
    reviewingAt: string | null;
    repliedAt: string | null;
    stampRequestedAt: string | null;
    archivedAt: string | null;
}

interface Stage {
    status: TrackingStatus;
    label: string;
    timestampKey: keyof TrackingData;
}

const STAGES: Stage[] = [
    { status: 'REVIEWING',     label: '審閱中', timestampKey: 'reviewingAt' },
    { status: 'REPLIED',       label: '已回覆', timestampKey: 'repliedAt' },
    { status: 'PENDING_STAMP', label: '待用印', timestampKey: 'stampRequestedAt' },
    { status: 'ARCHIVED',      label: '已歸檔', timestampKey: 'archivedAt' },
];

// Days in PENDING_STAMP before showing warning
const ARCHIVE_WARN_DAYS = 7;

function fmtDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function daysBetween(from: string | null, to: string | null): number | null {
    if (!from) return null;
    const end = to ? new Date(to) : new Date();
    return differenceInCalendarDays(end, new Date(from));
}

export default function ContractTimeline({ contractId }: { contractId: string }) {
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTracking = useCallback(async () => {
        try {
            const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}/tracking`);
            if (res.ok) setTracking(await res.json());
        } finally {
            setLoading(false);
        }
    }, [contractId]);

    useEffect(() => { fetchTracking(); }, [fetchTracking]);

    if (loading) {
        return (
            <div className="card p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-4">
                            <div className="w-4 h-4 rounded-full bg-gray-200 mt-1 shrink-0" />
                            <div className="flex-1 space-y-1">
                                <div className="h-3 bg-gray-200 rounded w-1/3" />
                                <div className="h-3 bg-gray-100 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // No tracking record yet — nothing to show
    if (!tracking) return null;

    const currentIdx = STAGES.findIndex(s => s.status === tracking.trackingStatus);

    return (
        <div className="card p-6">
            <h3 className="text-lg font-semibold mb-5 border-b pb-2">進度時間軸</h3>

            <div className="relative">
                {STAGES.map((stage, idx) => {
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isFuture = idx > currentIdx;
                    const isLast = idx === STAGES.length - 1;

                    const ts = tracking[stage.timestampKey] as string | null;
                    const nextTs = idx < STAGES.length - 1
                        ? tracking[STAGES[idx + 1].timestampKey] as string | null
                        : null;

                    // Duration: how long this stage took (or has been running)
                    const durationDays = isCurrent ? daysBetween(ts, null) : (isDone ? daysBetween(ts, nextTs) : null);

                    const isOverdue = isCurrent
                        && stage.status === 'PENDING_STAMP'
                        && durationDays !== null
                        && durationDays >= ARCHIVE_WARN_DAYS;

                    return (
                        <div key={stage.status} className="flex gap-4 relative">
                            {/* Vertical line */}
                            {!isLast && (
                                <div className={`absolute left-[7px] top-5 bottom-0 w-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                            )}

                            {/* Dot */}
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 z-10 ${
                                isDone    ? 'bg-green-500 border-green-500' :
                                isCurrent ? 'bg-blue-600 border-blue-600' :
                                            'bg-white border-gray-300'
                            }`} />

                            {/* Content */}
                            <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm ${
                                        isDone    ? 'text-green-700' :
                                        isCurrent ? 'text-blue-700' :
                                                    'text-gray-400'
                                    }`}>
                                        {stage.label}
                                    </span>

                                    {/* Duration badge */}
                                    {durationDays !== null && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            isOverdue
                                                ? 'bg-red-100 text-red-700'
                                                : isDone
                                                    ? 'bg-gray-100 text-gray-600'
                                                    : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {isCurrent ? `已進行 ${durationDays} 天` : `共 ${durationDays} 天`}
                                        </span>
                                    )}

                                    {/* Overdue warning */}
                                    {isOverdue && (
                                        <span className="text-xs text-red-600 font-semibold">
                                            ⚠ 超過 {ARCHIVE_WARN_DAYS} 天未歸檔
                                        </span>
                                    )}
                                </div>

                                {ts ? (
                                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(ts)}</p>
                                ) : isFuture ? (
                                    <p className="text-xs text-gray-400 mt-0.5 italic">尚未進入此階段</p>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
