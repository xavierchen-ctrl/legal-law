import Link from 'next/link';
import DraftingWorkbench from '@/components/DraftingWorkbench';

export default function DraftingPage() {
    return (
        <main className="container">
            <header className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-purple-600">
                        契約／法律文件撰擬
                    </h1>
                    <p className="text-gray-500 mt-1">AI 輔助法律文件起草、條文撰寫與修約作業</p>
                </div>
                <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors">
                    ← 返回主控台
                </Link>
            </header>
            <DraftingWorkbench />
        </main>
    );
}
