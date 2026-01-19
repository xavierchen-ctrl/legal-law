import { getSystemLogs, SystemLog } from '@/lib/logger';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SystemLogsPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token) {
        redirect('/login');
    }

    const logs = await getSystemLogs(100);

    return (
        <div className="p-8 container mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">系統日誌 (最近 100 筆)</h1>
                <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 underline">
                    回首頁
                </Link>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden border">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間 (Time)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">動作 (Action)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態 (Status)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">詳細訊息 (Message)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                    找不到日誌資料，或無法讀取 Google Sheet "System_Logs" 分頁。
                                </td>
                            </tr>
                        ) : (
                            logs.map((log, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.timestamp}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.action}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                                log.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'}`}>
                                            {log.status === 'SUCCESS' ? '成功' : log.status === 'ERROR' ? '錯誤' : log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.message}>
                                        {log.message}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-sm text-gray-500">
                資料來源: Google Sheets (System_Logs 分頁)
            </div>
        </div>
    );
}
