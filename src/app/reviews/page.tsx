'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReviewItem {
    fileId: string;
    fileName: string;
    scannedAt: string;
    matches: string;
    link: string;
    status: 'Unreviewed' | 'In Review' | 'Reviewed';
}

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Unreviewed' | 'In Review' | 'Reviewed'>('Unreviewed');

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
        // Optimistic Update
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
        inReview: reviews.filter(r => r.status === 'In Review').length,
        reviewed: reviews.filter(r => r.status === 'Reviewed').length
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">⚖️ 智慧審閱結果儀表板</h1>
                    <p className="text-gray-500 mt-2">檢視 AI 與關鍵字掃描結果，並追蹤審閱進度。</p>
                </div>
                <Link href="/" className="text-blue-600 hover:underline">
                    ← 返回主控台
                </Link>
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
                                                <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${m.includes('[AI]') ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {m.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <select
                                            value={item.status}
                                            onChange={(e) => handleStatusChange(item.fileId, e.target.value)}
                                            className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${item.status === 'Unreviewed' ? 'text-red-600 font-bold bg-red-50' :
                                                    item.status === 'In Review' ? 'text-yellow-600 font-bold bg-yellow-50' :
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
        </div>
    );
}
