'use client';

import Link from 'next/link';

// Define the shape of data passed from Server
export interface EnrichedContract {
    id: string;
    contractNumber: string;
    requestDate: string;
    department: string;
    requester: string;
    documentName: string;
    counterparty: string;
    status: string;
    priority: 'URGENT' | 'NORMAL';
    isOverdue: boolean;
    overdueDays: number;
    deadlineDisplay: string;
    lastReplyDate?: string | null;
    postReviewDays?: number;
    isPostReviewOverdue?: boolean;
}

export default function ContractsTable({ contracts }: { contracts: EnrichedContract[] }) {
    if (contracts.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white border rounded-lg">
                目前沒有合約資料或無法讀取試算表
            </div>
        );
    }

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-4 font-semibold text-gray-600">合約編號</th>
                            <th className="p-4 font-semibold text-gray-600">申請日</th>
                            <th className="p-4 font-semibold text-gray-600">部門/申請人</th>
                            <th className="p-4 font-semibold text-gray-600">文件名稱</th>
                            <th className="p-4 font-semibold text-gray-600">相對人</th>
                            <th className="p-4 font-semibold text-gray-600">狀態</th>
                            <th className="p-4 font-semibold text-gray-600">預計回覆</th>
                            <th className="p-4 font-semibold text-gray-600">動作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contracts.map((contract) => (
                            <tr key={contract.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium">{contract.contractNumber}</td>
                                <td className="p-4 text-sm text-gray-500">{contract.requestDate}</td>
                                <td className="p-4">
                                    <div className="font-medium text-sm">{contract.department}</div>
                                    <div className="text-xs text-gray-400">{contract.requester}</div>
                                </td>
                                <td className="p-4 text-sm max-w-[200px] truncate" title={contract.documentName}>
                                    {contract.documentName}
                                </td>
                                <td className="p-4 text-sm">{contract.counterparty}</td>
                                <td className="p-4">
                                    <span className={`badge ${contract.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' :
                                        contract.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-700' :
                                            contract.status === 'AWAITING_FEEDBACK' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-indigo-50 text-indigo-700'
                                        }`}>
                                        {contract.status === 'SUBMITTED' && '申請中'}
                                        {contract.status === 'IN_REVIEW' && '審閱中'}
                                        {contract.status === 'AWAITING_FEEDBACK' && '待回覆'}
                                        {contract.status === 'PAUSED' && '暫停'}
                                        {contract.status === 'CLOSED' && '已結案'}
                                    </span>
                                    {contract.priority === 'URGENT' && contract.status !== 'CLOSED' && (
                                        <span className="ml-2 badge bg-red-100 text-red-600">急</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">
                                        {contract.deadlineDisplay}
                                    </div>
                                    {contract.isOverdue && (
                                        <div className="text-xs text-red-500 font-bold">
                                            逾期 {contract.overdueDays} 天
                                        </div>
                                    )}
                                    {/* Post-Review Alert */}
                                    {!contract.isOverdue && contract.lastReplyDate && contract.status !== 'CLOSED' && (
                                        <div className="mt-1">
                                            <div className="text-xs text-blue-600">
                                                已回覆 {contract.postReviewDays} 天
                                            </div>
                                            {contract.isPostReviewOverdue && (
                                                <div className="text-xs text-orange-600 font-bold">
                                                    ⚠️ 未結案逾期
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <Link href={`/contracts/${encodeURIComponent(contract.id)}`} className="text-sm font-medium text-blue-600 hover:underline">
                                        詳情
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
