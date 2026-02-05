
import Link from 'next/link';
import packageJson from '../../../package.json';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Admin Header / Nav */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold text-gray-800 hover:text-blue-600">Legal Flow</Link>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500 font-medium">後台管理系統</span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        v{packageJson.version}
                    </div>
                </div>
            </header>

            {/* Admin Navigation Tabs */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8">
                    <Link href="/admin/keywords" className="py-4 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500">
                        關鍵字監控
                    </Link>
                    <Link href="/admin/ai-rules" className="py-4 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500">
                        AI 規則設定
                    </Link>
                    <Link href="/admin/logs" className="py-4 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500">
                        系統日誌
                    </Link>
                </div>
            </div>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
