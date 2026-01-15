'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ContractActions({ contract }: { contract: any }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const updateStatus = async (newStatus: string) => {
        if (!confirm(`確定將狀態變更為 ${newStatus} 嗎？`)) return;
        setLoading(true);
        try {
            await fetch(`/api/contracts/${contract.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            router.refresh();
        } catch (e) {
            alert('更新失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {contract.status === 'SUBMITTED' && (
                <button
                    onClick={() => updateStatus('IN_REVIEW')}
                    disabled={loading}
                    className="btn btn-primary w-full"
                >
                    開始審閱
                </button>
            )}

            {contract.status === 'IN_REVIEW' && (
                <>
                    <button
                        onClick={() => updateStatus('AWAITING_FEEDBACK')}
                        disabled={loading}
                        className="btn w-full bg-yellow-500 text-white hover:bg-yellow-600"
                    >
                        等待需求單位回覆
                    </button>
                    <button
                        onClick={() => updateStatus('CLOSED')}
                        disabled={loading}
                        className="btn w-full bg-green-600 text-white hover:bg-green-700"
                    >
                        結案 (完成)
                    </button>
                </>
            )}

            {contract.status === 'AWAITING_FEEDBACK' && (
                <button
                    onClick={() => updateStatus('IN_REVIEW')}
                    disabled={loading}
                    className="btn btn-primary w-full"
                >
                    恢復審閱
                </button>
            )}

            {contract.status !== 'CLOSED' && (
                <button
                    onClick={() => updateStatus('PAUSED')}
                    disabled={loading}
                    className="btn w-full border border-gray-300 hover:bg-gray-50"
                >
                    暫停案件
                </button>
            )}

            {contract.status === 'CLOSED' && (
                <div className="text-center text-green-600 font-bold p-4 bg-green-50 rounded">
                    此案件已結案
                </div>
            )}
        </div>
    );
}
