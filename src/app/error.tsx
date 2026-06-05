'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[GlobalError]', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="card max-w-md w-full p-8 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">頁面載入失敗</h2>
                <p className="text-sm text-gray-500 mb-6">
                    系統發生錯誤，請重試或返回首頁。
                    {error?.digest && (
                        <span className="block mt-1 font-mono text-xs text-gray-400">
                            錯誤代碼：{error.digest}
                        </span>
                    )}
                </p>
                <div className="flex gap-3 justify-center">
                    <button onClick={reset} className="btn btn-primary">
                        重試
                    </button>
                    <Link href="/" className="btn border border-gray-300 hover:bg-gray-50">
                        返回首頁
                    </Link>
                </div>
            </div>
        </div>
    );
}
