'use client';

import { useRef, useState } from 'react';

interface Props {
    onTextExtracted: (text: string, fileName: string, charCount: number) => void;
    onError: (msg: string) => void;
    accentColor?: string; // tailwind color key e.g. 'blue', 'teal', 'rose'
}

export default function FileUploadZone({ onTextExtracted, onError, accentColor = 'blue' }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploaded, setUploaded] = useState<{ name: string; charCount: number } | null>(null);
    const [dragging, setDragging] = useState(false);

    const borderColor = {
        blue: 'border-blue-300 hover:border-blue-400',
        teal: 'border-teal-300 hover:border-teal-400',
        rose: 'border-rose-300 hover:border-rose-400',
        orange: 'border-orange-300 hover:border-orange-400',
        green: 'border-green-300 hover:border-green-400',
    }[accentColor] ?? 'border-blue-300 hover:border-blue-400';

    const bgDrag = {
        blue: 'bg-blue-50',
        teal: 'bg-teal-50',
        rose: 'bg-rose-50',
        orange: 'bg-orange-50',
        green: 'bg-green-50',
    }[accentColor] ?? 'bg-blue-50';

    const processFile = async (file: File) => {
        const allowed = ['.pdf', '.docx', '.txt'];
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!allowed.includes(ext)) {
            onError('僅支援 PDF、DOCX、TXT 格式');
            return;
        }

        setUploading(true);
        setUploaded(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/extract-text', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error ?? '檔案解析失敗');

            setUploaded({ name: file.name, charCount: data.charCount });
            onTextExtracted(data.text, file.name, data.charCount);
        } catch (err: any) {
            onError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer px-4 py-6 text-center
                ${dragging ? `${bgDrag} border-opacity-100` : 'bg-white border-opacity-60'}
                ${borderColor}`}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleFileChange}
            />

            {uploading ? (
                <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <p className="text-xs text-gray-500">解析檔案中...</p>
                </div>
            ) : uploaded ? (
                <div className="flex flex-col items-center gap-1.5">
                    <span className="text-2xl">✅</span>
                    <p className="text-xs font-semibold text-gray-700 truncate max-w-full">{uploaded.name}</p>
                    <p className="text-xs text-gray-400">{uploaded.charCount.toLocaleString()} 字元已擷取</p>
                    <p className="text-xs text-gray-400 mt-1">點擊重新上傳</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📂</span>
                    <p className="text-sm font-medium text-gray-600">點擊或拖曳檔案上傳</p>
                    <p className="text-xs text-gray-400">支援 PDF · DOCX · TXT</p>
                </div>
            )}
        </div>
    );
}
