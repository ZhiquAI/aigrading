'use client';

import { useState, useEffect, useCallback } from 'react';
import CodeList from './components/CodeList';
import CreateCodeModal from './components/CreateCodeModal';

export default function CodesPage() {
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filter, setFilter] = useState('all'); // all, unused, used
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCodes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ filter });
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`/api/admin/codes?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setCodes(data.data.codes);
            }
        } catch (error) {
            console.error('Fetch codes error:', error);
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm]);

    const handleExportCodes = async () => {
        const params = new URLSearchParams({ filter });
        if (searchTerm) params.append('search', searchTerm);

        const url = `/api/admin/codes/export?${params.toString()}`;
        const token = localStorage.getItem('admin_token');

        try {
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `activation_codes_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);
            } else {
                alert('导出失败');
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('网络错误，请稍后重试');
        }
    };

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    return (
        <div className="max-w-6xl mx-auto">
            {/* 顶栏 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">激活码管理</h1>
                    <p className="text-gray-500 text-sm mt-1">管理系统的所有激活码、充值卡及机构授权</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCodes}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                    >
                        <span>📥</span>
                        <span>导出 CSV</span>
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                    >
                        <span>✨</span>
                        <span className="font-medium">生成激活码</span>
                    </button>
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 min-w-[200px]">
                    <span className="text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="搜索激活码..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-gray-900 placeholder-gray-400"
                    />
                </div>

                <div className="flex gap-2">
                    {['all', 'unused', 'used'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {f === 'all' && '全部'}
                            {f === 'unused' && '未使用'}
                            {f === 'used' && '已使用'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 列表 */}
            <CodeList codes={codes} loading={loading} onRefresh={fetchCodes} />

            {/* 弹窗 */}
            <CreateCodeModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    fetchCodes();
                    // 显示成功提示可以加在这里
                }}
            />
        </div>
    );
}
