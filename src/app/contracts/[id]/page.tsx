import { fetchContractsFromSheet } from '@/lib/google-sheets';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const contracts = await fetchContractsFromSheet();
    const contract = contracts.find(c => c.id === decodeURIComponent(id));

    if (!contract) return notFound();

    return (
        <main className="container py-12">
            <Link href="/" className="text-gray-500 hover:text-gray-900 mb-6 inline-block">
                &larr; 返回儀表板
            </Link>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                        {contract.contractNumber}
                    </h1>
                    <p className="text-xl text-gray-700">{contract.documentName}</p>
                </div>
                <div className="flex gap-2">
                    <span className={`badge ${contract.priority === 'URGENT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                        {contract.priority === 'URGENT' ? '急件' : '普通件'}
                    </span>
                    <span className="badge bg-gray-100 text-gray-700">
                        {contract.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4 border-b pb-2">基本資訊 (同步模式)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">需求部門</label>
                                <div className="font-medium">{contract.department}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">申請人</label>
                                <div className="font-medium">{contract.requester}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">相對人</label>
                                <div className="font-medium">{contract.counterparty}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">申請日期</label>
                                <div className="font-medium">{contract.requestDate}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">預計回覆日</label>
                                <div className="font-medium text-blue-600">
                                    {contract.estimatedReplyDate || '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions & Status */}
                <div className="space-y-6">
                    <div className="card glass-panel p-6">
                        <h3 className="text-lg font-semibold mb-4">案件操作</h3>
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm mb-4">
                            目前為同步模式，請前往 Google 試算表進行編輯。
                        </div>
                        <a href="https://docs.google.com/spreadsheets/d/1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE/edit" target="_blank" className="btn btn-primary w-full">
                            前往試算表編輯
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
