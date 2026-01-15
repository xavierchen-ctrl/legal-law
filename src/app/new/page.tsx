'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewContractPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        department: '',
        requester: '',
        requesterEmail: '',
        counterparty: '',
        documentName: '',
        priority: 'NORMAL',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Failed to create contract');

            router.push('/');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('建立合約失敗，請稍後再試。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container max-w-2xl py-12">
            <Link href="/" className="text-gray-500 hover:text-gray-900 mb-6 inline-block">
                &larr; 返回儀表板
            </Link>

            <div className="card glass-panel p-8">
                <h1 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                    建立新合約案件
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">需求部門</label>
                            <input
                                type="text"
                                name="department"
                                required
                                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="例如：行銷部"
                                value={formData.department}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">申請人</label>
                            <input
                                type="text"
                                name="requester"
                                required
                                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="中文姓名"
                                value={formData.requester}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">申請人 Email (用於通知)</label>
                        <input
                            type="email"
                            name="requesterEmail"
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            placeholder="user@company.com"
                            value={formData.requesterEmail}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">文件名稱</label>
                        <input
                            type="text"
                            name="documentName"
                            required
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            placeholder="例如：行銷合作協議書"
                            value={formData.documentName}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">相對人 (簽約對象)</label>
                        <input
                            type="text"
                            name="counterparty"
                            required
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            placeholder="公司名稱或個人"
                            value={formData.counterparty}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">案件急迫性</label>
                        <select
                            name="priority"
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white"
                            value={formData.priority}
                            onChange={handleChange}
                        >
                            <option value="NORMAL">普通件 (預計 5 天)</option>
                            <option value="URGENT">急件 (預計 3 天)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            * 急件逾期 1 天將通知執行長；普通件逾期 3 天將通知執行長。
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full btn btn-primary py-3 text-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? '提交中...' : '送出申請'}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
