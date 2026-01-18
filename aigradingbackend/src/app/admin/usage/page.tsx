'use client';

export default function UsagePage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">使用统计</h1>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">
                    💡 UI组件正在开发中，API已就绪：
                    <code className="ml-2 px-2 py-1 bg-white rounded">GET /api/admin/logs</code>
                </p>
            </div>
        </div>
    );
}
