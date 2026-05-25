'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

const STATUS_OPTIONS = [
    { value: '',                  label: '全部狀態' },
    { value: 'IN_REVIEW',         label: '審閱中' },
    { value: 'AWAITING_FEEDBACK', label: '已回覆' },
    { value: 'PENDING_STAMP',     label: '待用印' },
    { value: 'CLOSED',            label: '已歸檔' },
    { value: 'SUBMITTED',         label: '待審閱' },
    { value: 'PAUSED',            label: '暫停' },
];

export default function FilterBar() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set(key, value);
        else params.delete(key);
        replace(`${pathname}?${params.toString()}`);
    };

    const handleSearch = useDebouncedCallback(
        (term: string) => setParam('q', term),
        300
    );

    const hasActiveFilters = ['q', 'dept', 'urgent', 'status', 'dateFrom', 'dateTo', 'replyFrom', 'replyTo'].some(
        k => searchParams.get(k)
    );

    const clearAll = () => {
        const params = new URLSearchParams(searchParams);
        ['q', 'dept', 'urgent', 'status', 'dateFrom', 'dateTo', 'replyFrom', 'replyTo'].forEach(k => params.delete(k));
        replace(`${pathname}?${params.toString()}`);
    };

    const currentSort = searchParams.get('sort') ?? 'newest';

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 divide-y divide-gray-100">
            {/* Row 1: 搜尋 / 部門 / 狀態 / 急件 / 排序 */}
            <div className="p-4 flex flex-wrap gap-4 items-end">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        搜尋合約/相對人/文件
                    </label>
                    <input
                        type="text"
                        placeholder="輸入關鍵字..."
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        onChange={e => handleSearch(e.target.value)}
                        defaultValue={searchParams.get('q') ?? ''}
                    />
                </div>

                {/* Department */}
                <div className="w-[160px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        部門
                    </label>
                    <input
                        type="text"
                        placeholder="輸入部門名稱..."
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        onChange={e => setParam('dept', e.target.value)}
                        defaultValue={searchParams.get('dept') ?? ''}
                    />
                </div>

                {/* Status */}
                <div className="w-[140px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        狀態
                    </label>
                    <select
                        value={searchParams.get('status') ?? ''}
                        onChange={e => setParam('status', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-700"
                    >
                        {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* Urgent */}
                <div className="flex items-center pb-0.5">
                    <label className="flex items-center cursor-pointer gap-2">
                        <input
                            type="checkbox"
                            className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                            onChange={e => setParam('urgent', e.target.checked ? 'true' : '')}
                            defaultChecked={searchParams.get('urgent') === 'true'}
                        />
                        <span className="font-medium text-gray-700 text-sm whitespace-nowrap">只看急件</span>
                    </label>
                </div>

                {/* Sort */}
                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        排序
                    </label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                        <button
                            onClick={() => setParam('sort', 'newest')}
                            className={`px-3 py-2 transition-colors ${currentSort === 'newest' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            ↓ 新到舊
                        </button>
                        <button
                            onClick={() => setParam('sort', 'oldest')}
                            className={`px-3 py-2 transition-colors ${currentSort === 'oldest' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                            ↑ 舊到新
                        </button>
                    </div>
                </div>

                {/* Clear */}
                {hasActiveFilters && (
                    <div className="flex items-end">
                        <button
                            onClick={clearAll}
                            className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg hover:border-red-300 transition-colors bg-white"
                        >
                            ✕ 清除篩選
                        </button>
                    </div>
                )}
            </div>

            {/* Row 2: 日期篩選 */}
            <div className="px-4 py-3 flex flex-wrap gap-4 items-end bg-gray-50/50">
                {/* Request Date Range */}
                <div className="flex items-end gap-2">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                            申請日期（起）
                        </label>
                        <input
                            type="date"
                            value={searchParams.get('dateFrom') ?? ''}
                            onChange={e => setParam('dateFrom', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
                        />
                    </div>
                    <span className="text-gray-400 text-sm pb-2">—</span>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                            申請日期（迄）
                        </label>
                        <input
                            type="date"
                            value={searchParams.get('dateTo') ?? ''}
                            onChange={e => setParam('dateTo', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
                        />
                    </div>
                </div>

                {/* Reply Date Range */}
                <div className="flex items-end gap-2">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                            預計回覆日（起）
                        </label>
                        <input
                            type="date"
                            value={searchParams.get('replyFrom') ?? ''}
                            onChange={e => setParam('replyFrom', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
                        />
                    </div>
                    <span className="text-gray-400 text-sm pb-2">—</span>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                            預計回覆日（迄）
                        </label>
                        <input
                            type="date"
                            value={searchParams.get('replyTo') ?? ''}
                            onChange={e => setParam('replyTo', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
