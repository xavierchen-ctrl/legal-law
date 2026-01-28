import { getKeywords, addKeyword, deleteKeyword } from '@/lib/keyword-service';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';


export default async function KeywordAdminPage() {
    const rules = await getKeywords();

    async function handleAdd(formData: FormData) {
        'use server';
        const keyword = formData.get('keyword') as string;
        const email = formData.get('email') as string;
        const desc = formData.get('desc') as string;

        if (keyword && email) {
            await addKeyword({
                keyword,
                targetEmail: email,
                description: desc,
                isActive: true
            });
            revalidatePath('/admin/keywords');
        }
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">關鍵字監控設定 (Keyword Monitor)</h1>
                <Link href="/admin/logs" className="text-blue-600 hover:underline">
                    查看系統日誌 &rarr;
                </Link>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-lg font-semibold mb-4">新增規則</h2>
                <form action={handleAdd} className="flex gap-4 items-end flex-wrap">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">關鍵字</label>
                        <input name="keyword" required placeholder="例如: 機密" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">通知對象 Email</label>
                        <input name="email" required placeholder="user@example.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                    </div>
                    <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700">說明 (選填)</label>
                        <input name="desc" placeholder="規則描述" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                    </div>
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                        新增
                    </button>
                </form>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {rules.length === 0 ? (
                        <li className="p-4 text-center text-gray-500">目前沒有設定任何關鍵字規則。</li>
                    ) : (
                        rules.map((rule, idx) => (
                            <li key={idx} className="px-6 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-medium text-gray-900">{rule.keyword}</p>
                                    <p className="text-sm text-gray-500">通知: {rule.targetEmail}</p>
                                    {rule.description && <p className="text-sm text-gray-400">{rule.description}</p>}
                                </div>
                                <div>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {rule.isActive ? '啟用中' : '已停用'}
                                    </span>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            <div className="mt-6 text-sm text-gray-500">
                <p>💡 說明：系統每小時會掃描一次 Google Drive 指定資料夾的新增檔案。若內容包含上述關鍵字，將發信通知指定人員。</p>
                <p>🗑️ 刪除規則：目前請直接前往 <a href={process.env.SHEET_CSV_URL?.replace('/pub?gid=0&single=true&output=csv', '')} target="_blank" className="text-blue-600 underline">Google Sheets (Keyword_Rules 分頁)</a> 刪除整行。</p>
            </div>
        </div>
    );
}
