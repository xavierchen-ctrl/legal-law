
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AIRule {
    ruleName: string;
    promptInstruction: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    targetEmail: string;
}

export default function AIRulesAdminPage({ initialRules }: { initialRules: AIRule[] }) {
    const router = useRouter();
    const [rules, setRules] = useState<AIRule[]>(initialRules);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newRule, setNewRule] = useState<AIRule>({
        ruleName: '',
        promptInstruction: '',
        riskLevel: 'MEDIUM',
        targetEmail: ''
    });

    async function handleAdd() {
        if (!newRule.ruleName || !newRule.promptInstruction) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/admin/ai-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRule)
            });

            if (res.ok) {
                setRules([...rules, newRule]);
                setNewRule({ ruleName: '', promptInstruction: '', riskLevel: 'MEDIUM', targetEmail: '' });
                router.refresh(); // Refresh Server Component
            } else {
                alert('Add Failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error');
        } finally {
            setIsSubmitting(false);
        }
    }

    // ... inside AIRulesAdminPage ...
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<AIRule | null>(null);

    // ... handleAdd ...

    async function handleDelete(index: number, name: string) {
        if (!confirm(`確定要刪除規則 "${name}" 嗎？此操作無法復原。`)) return;

        try {
            const res = await fetch(`/api/admin/ai-rules?index=${index}`, { method: 'DELETE' });
            if (res.ok) {
                const newRules = rules.filter((_, i) => i !== index);
                setRules(newRules);
                router.refresh();
            } else {
                alert('刪除失敗');
            }
        } catch (e) {
            console.error(e);
            alert('刪除發生錯誤');
        }
    }

    function startEdit(index: number) {
        setEditingIndex(index);
        setEditForm({ ...rules[index] });
    }

    async function saveEdit() {
        if (editingIndex === null || !editForm) return;

        try {
            const res = await fetch('/api/admin/ai-rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: editingIndex, rule: editForm })
            });

            if (res.ok) {
                const newRules = [...rules];
                newRules[editingIndex] = editForm;
                setRules(newRules);
                setEditingIndex(null);
                setEditForm(null);
                router.refresh();
            } else {
                alert('更新失敗');
            }
        } catch (e) {
            console.error(e);
            alert('更新發生錯誤');
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">🧠 AI 智慧審閱規則設定 (V2)</h1>

            {/* Edit Modal (Simple Inline Overlay) */}
            {editingIndex !== null && editForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl">
                        <h2 className="text-xl font-bold mb-4">編輯規則</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">規則名稱</label>
                                <input className="w-full border p-2 rounded" value={editForm.ruleName} onChange={e => setEditForm({ ...editForm, ruleName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">風險等級</label>
                                <select className="w-full border p-2 rounded" value={editForm.riskLevel} onChange={e => setEditForm({ ...editForm, riskLevel: e.target.value as any })}>
                                    <option value="HIGH">🔴 High</option>
                                    <option value="MEDIUM">🟡 Medium</option>
                                    <option value="LOW">🟢 Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">AI 指令</label>
                                <textarea className="w-full border p-2 rounded" rows={3} value={editForm.promptInstruction} onChange={e => setEditForm({ ...editForm, promptInstruction: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">通知 Email</label>
                                <input className="w-full border p-2 rounded" value={editForm.targetEmail} onChange={e => setEditForm({ ...editForm, targetEmail: e.target.value })} />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setEditingIndex(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                            <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">儲存變更</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Rules Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">規則名稱</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI 指令 (Prompt)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">風險等級</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通知對象</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {rules.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">目前沒有 AI 規則。請新增。</td>
                            </tr>
                        ) : (
                            rules.map((rule, idx) => (
                                <tr key={idx}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{rule.ruleName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-sm truncate" title={rule.promptInstruction}>
                                        {rule.promptInstruction}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${rule.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                                                rule.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'}`}>
                                            {rule.riskLevel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.targetEmail || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2">
                                        <button onClick={() => startEdit(idx)} className="text-blue-600 hover:text-blue-900 font-medium">編輯</button>
                                        <button onClick={() => handleDelete(idx, rule.ruleName)} className="text-red-600 hover:text-red-900 font-medium">刪除</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add New Rule Form */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">✨ 新增 AI 審閱規則</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">規則名稱</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="例：智財權歸屬檢查"
                            value={newRule.ruleName}
                            onChange={e => setNewRule({ ...newRule, ruleName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">風險等級</label>
                        <select
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            value={newRule.riskLevel}
                            onChange={e => setNewRule({ ...newRule, riskLevel: e.target.value as any })}
                        >
                            <option value="HIGH">🔴 High (高風險)</option>
                            <option value="MEDIUM">🟡 Medium (一般)</option>
                            <option value="LOW">🟢 Low (低風險)</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">AI 指令 (Prompt)</label>
                        <p className="text-xs text-gray-500 mb-1">請用自然語言描述，例如：「檢查合約中是否有對我不利的賠償條款...」</p>
                        <textarea
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="請檢查從文件中提取的內容，若發現 [情況] 則標記為風險..."
                            value={newRule.promptInstruction}
                            onChange={e => setNewRule({ ...newRule, promptInstruction: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">通知對象 (Email)</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="admin@example.com (可留空)"
                            value={newRule.targetEmail}
                            onChange={e => setNewRule({ ...newRule, targetEmail: e.target.value })}
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleAdd}
                        disabled={isSubmitting || !newRule.ruleName || !newRule.promptInstruction}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isSubmitting ? '處理中...' : '新增規則'}
                    </button>
                </div>
            </div>

            <div className="mt-6 text-sm text-gray-500">
                <p>💡 說明：AI 規則會比關鍵字更消耗資源，建議只設定必要的複雜邏輯。</p>
            </div>
        </div>
    );
}
