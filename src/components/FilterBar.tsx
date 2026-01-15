'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function FilterBar() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set('q', term);
        } else {
            params.delete('q');
        }
        replace(`${pathname}?${params.toString()}`);
    }, 300);

    const handleDepartmentChange = (dept: string) => {
        const params = new URLSearchParams(searchParams);
        if (dept && dept !== 'ALL') {
            params.set('dept', dept);
        } else {
            params.delete('dept');
        }
        replace(`${pathname}?${params.toString()}`);
    };

    const handleUrgentToggle = (checked: boolean) => {
        const params = new URLSearchParams(searchParams);
        if (checked) {
            params.set('urgent', 'true');
        } else {
            params.delete('urgent');
        }
        replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                    搜尋合約/相對人/文件
                </label>
                <input
                    type="text"
                    placeholder="輸入關鍵字..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    onChange={(e) => handleSearch(e.target.value)}
                    defaultValue={searchParams.get('q')?.toString()}
                />
            </div>

            {/* Department Filter (Simple Input for now, can be Select if we aggregate depts) */}
            <div className="w-[180px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                    部門篩選
                </label>
                <input
                    type="text"
                    placeholder="輸入部門名稱..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    defaultValue={searchParams.get('dept')?.toString()}
                />
            </div>

            {/* Urgent Toggle */}
            <div className="flex items-center pt-5">
                <label className="flex items-center cursor-pointer gap-2">
                    <input
                        type="checkbox"
                        className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                        onChange={(e) => handleUrgentToggle(e.target.checked)}
                        defaultChecked={searchParams.get('urgent') === 'true'}
                    />
                    <span className="font-medium text-gray-700">只看急件 (Urgent Only)</span>
                </label>
            </div>
        </div>
    );
}
