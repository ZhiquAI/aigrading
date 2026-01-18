'use client';

export default function DashboardPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">数据概览</h1>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                <div className="text-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">后端管理后台已就绪</h2>
                    <p className="text-gray-600 mb-6">
                        API已完成，数据库已连接，管理功能正在开发中...
                    </p>

                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-3xl font-bold text-blue-600">✓</div>
                            <div className="text-sm text-gray-600 mt-2">SQLite数据库</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-3xl font-bold text-green-600">✓</div>
                            <div className="text-sm text-gray-600 mt-2">客户端API</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="text-3xl font-bold text-purple-600">✓</div>
                            <div className="text-sm text-gray-600 mt-2">JWT认证</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
