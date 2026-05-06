'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    title: string;
    message?: string;
}

export default function LoadingModal({ open, title, message }: Props) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop — pointer-events-auto so it blocks clicks, but not cursor-move events */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" />

            {/* Modal card */}
            <div className="relative bg-white rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center gap-5 w-full max-w-sm mx-4 pointer-events-auto">
                {/* Spinner */}
                <div className="relative flex items-center justify-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span className="absolute text-xl">🤖</span>
                </div>

                {/* Text */}
                <div className="text-center space-y-1.5">
                    <p className="text-base font-bold text-gray-800">{title}</p>
                    {message && (
                        <p className="text-xs text-gray-500 leading-relaxed">{message}</p>
                    )}
                </div>

                {/* Bouncing dots */}
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>

                <p className="text-xs text-gray-400">請勿關閉或重新整理頁面</p>
            </div>
        </div>,
        document.body
    );
}
