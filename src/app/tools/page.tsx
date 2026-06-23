'use client';

import Link from 'next/link';
import ContractToolTabs from '@/components/ContractToolTabs';

export default function ToolsPage() {
    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        🛠️ AI 合約審閱工具
                    </h1>
                    <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                        直接上傳或貼上任何合約文字即可使用，不限於本系統內案件。
                        支援多家公司、多案件之合約審閱、版本比對、付款條件分析、商工資料比對等。
                    </p>
                </div>
                <Link href="/" className="text-blue-600 hover:underline text-sm whitespace-nowrap mt-1">
                    ← 返回主控台
                </Link>
            </header>

            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 mb-4 text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">📌 使用說明</p>
                <ul className="space-y-0.5 ml-4 list-disc">
                    <li>各工具皆可獨立使用，無需先建立案件</li>
                    <li>上傳 PDF / DOCX / TXT 檔案，或直接貼上合約文字</li>
                    <li>商工比對僅需輸入統一編號即可查詢（不需上傳檔案）</li>
                    <li>分析結果不會寫回案件資料庫，純為審閱輔助</li>
                </ul>
            </div>

            <ContractToolTabs
                documentName=""
                contractNumber=""
                companyName=""
                businessNo=""
            />
        </div>
    );
}
