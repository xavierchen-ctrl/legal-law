'use client';

import { useState, useEffect } from 'react';

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const storedKey = localStorage.getItem('legal_flow_user_api_key');
            if (storedKey) setApiKey(storedKey);
        }
    }, [isOpen]);

    const handleSave = () => {
        if (apiKey.trim()) {
            localStorage.setItem('legal_flow_user_api_key', apiKey.trim());
        } else {
            localStorage.removeItem('legal_flow_user_api_key');
        }
        onClose();
        alert('API Key 已儲存！\n接下來的手動掃描將優先使用此 Key。');
    };

    const handleClear = () => {
        localStorage.removeItem('legal_flow_user_api_key');
        setApiKey('');
        onClose();
        alert('已清除個人 API Key，將恢復使用系統預設 Key。');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">🔑 設定個人 OpenAI API Key</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                    您可以輸入個人的 OpenAI API Key。設定後，手動執行的掃描與分析將使用您的配額，不會佔用系統共用額度。
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                    <div className="relative">
                        <input
                            type={isVisible ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-proj-..."
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={() => setIsVisible(!isVisible)}
                            className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-xs"
                        >
                            {isVisible ? '隱藏' : '顯示'}
                        </button>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                        還沒有 Key？ <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-500 underline">前往 OpenAI Platform 申請</a>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded text-sm font-medium"
                    >
                        清除 Key
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-bold"
                    >
                        儲存設定
                    </button>
                </div>
            </div>
        </div>
    );
}
