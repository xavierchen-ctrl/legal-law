'use client';

import { useState, useEffect } from 'react';
import AISettingsModal from './AISettingsModal';

export default function GlobalSettings() {
    const [isModalOpen, setModalOpen] = useState(false);
    const [hasCustomKey, setHasCustomKey] = useState(false);

    useEffect(() => {
        // Check if key exists on mount
        const key = localStorage.getItem('legal_flow_user_api_key');
        setHasCustomKey(!!key);

        // Listen for storage events (if multiple tabs) or custom events could be better, 
        // but for now simple check is fine. 
        // We can't easily detect localStorage change in same window without custom event.
    }, [isModalOpen]); // Re-check when modal closes

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                className="fixed bottom-4 right-4 bg-white p-2 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 z-40 flex items-center gap-2 transition-all opacity-80 hover:opacity-100"
                title="設定個人 API Key"
            >
                <span className="text-xl">⚙️</span>
                {hasCustomKey && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                )}
            </button>

            <AISettingsModal
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
