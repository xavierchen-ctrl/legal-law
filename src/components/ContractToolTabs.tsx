'use client';

import { useState } from 'react';
import GcisVerifyPanel from '@/components/GcisVerifyPanel';
import ArchitectureReviewPanel from '@/components/ArchitectureReviewPanel';
import ContractTranslationPanel from '@/components/ContractTranslationPanel';
import ContractChToEnPanel from '@/components/ContractChToEnPanel';
import ContractNameReviewPanel from '@/components/ContractNameReviewPanel';
import PaymentCheckPanel from '@/components/PaymentCheckPanel';
import ContractReportPanel from '@/components/ContractReportPanel';
import ContractDiffPanel from '@/components/ContractDiffPanel';

interface Props {
    documentName: string;
    contractNumber: string;
    companyName: string;
    businessNo: string;
    counterparty?: string;
}

const TABS = [
    { id: 'gcis',         label: '工商比對',     icon: '🏢' },
    { id: 'diff',         label: '版本比對',     icon: '🔍' },
    { id: 'architecture', label: '架構檢視',     icon: '🤖' },
    { id: 'translation',  label: '翻譯',         icon: '🌐' },
    { id: 'name-review',  label: '名稱與前言',   icon: '📋' },
    { id: 'payment',      label: '付款條件比對', icon: '💳' },
    { id: 'report',       label: '審閱報告',     icon: '📊' },
] as const;

type TabId = typeof TABS[number]['id'];
type TranslationDirection = 'en-to-zh' | 'zh-to-en';

export default function ContractToolTabs({ documentName, contractNumber, companyName, businessNo, counterparty }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>('gcis');
    const [translationDir, setTranslationDir] = useState<TranslationDirection>('en-to-zh');

    return (
        <div className="card overflow-hidden shadow-sm border border-gray-200">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-700 bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="p-4">
                {activeTab === 'gcis' && (
                    <GcisVerifyPanel
                        companyName={companyName}
                        businessNo={businessNo}
                    />
                )}
                {activeTab === 'diff' && (
                    <ContractDiffPanel />
                )}
                {activeTab === 'architecture' && (
                    <ArchitectureReviewPanel
                        documentName={documentName}
                        contractNumber={contractNumber}
                    />
                )}
                {activeTab === 'translation' && (
                    <div className="space-y-3">
                        {/* Direction toggle */}
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold w-fit">
                            <button
                                onClick={() => setTranslationDir('en-to-zh')}
                                className={`px-5 py-2 transition-colors ${
                                    translationDir === 'en-to-zh'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                🌐 英翻中
                            </button>
                            <button
                                onClick={() => setTranslationDir('zh-to-en')}
                                className={`px-5 py-2 transition-colors ${
                                    translationDir === 'zh-to-en'
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                📝 中翻英
                            </button>
                        </div>

                        {translationDir === 'en-to-zh' ? (
                            <ContractTranslationPanel
                                documentName={documentName}
                                contractNumber={contractNumber}
                            />
                        ) : (
                            <ContractChToEnPanel
                                documentName={documentName}
                                contractNumber={contractNumber}
                            />
                        )}
                    </div>
                )}
                {activeTab === 'name-review' && (
                    <ContractNameReviewPanel
                        documentName={documentName}
                        contractNumber={contractNumber}
                    />
                )}
                {activeTab === 'payment' && (
                    <PaymentCheckPanel
                        documentName={documentName}
                        contractNumber={contractNumber}
                        counterparty={counterparty}
                    />
                )}
                {activeTab === 'report' && (
                    <ContractReportPanel
                        documentName={documentName}
                        contractNumber={contractNumber}
                    />
                )}
            </div>
        </div>
    );
}
