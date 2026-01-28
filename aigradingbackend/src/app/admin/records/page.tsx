'use client';

import { useState, useEffect, useCallback } from 'react';
import RecordsTable from './components/RecordsTable';
import RecordDetailModal from './components/RecordDetailModal';

export default function RecordsPage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('all'); // all, today, week

    // 使用 useCallback 避免 useEffect 依赖变化导致死循环
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('studentName', searchTerm);
            if (dateRange !== 'all') {
                const now = new Date();
                if (dateRange === 'today') {
                    params.append('startDate', new Date(now.setHours(0, 0, 0, 0)).toISOString());
                } else if (dateRange === 'week') {
                    const lastWeek = new Date(now.setDate(now.getDate() - 7));
                    params.append('startDate', lastWeek.toISOString());
                }
            }

            const res = await fetch(`/api/admin/records?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setRecords(data.data.records || []);
            }
        } catch (error) {
            console.error('Fetch records error:', error);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, dateRange]);

    const handleExport = async () => {
        const params = new URLSearchParams();
        if (searchTerm) params.append('studentName', searchTerm);
        if (dateRange !== 'all') {
            const now = new Date();
            if (dateRange === 'today') {
                params.append('startDate', new Date(now.setHours(0, 0, 0, 0)).toISOString());
            } else if (dateRange === 'week') {
                const lastWeek = new Date(now.setDate(now.getDate() - 7));
                params.append('startDate', lastWeek.toISOString());
            }
        }

        const url = `/api/admin/records/export?${params.toString()}`;
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
                a.download = `grading_records_${new Date().toISOString().split('T')[0]}.csv`;
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
        // 防抖搜索
        const timer = setTimeout(() => {
            fetchRecords();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchRecords]);

    return (
        <div className="max-w-6xl mx-auto">
            {/* 顶栏 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">批改记录</h1>
                    <p className="text-gray-500 text-sm mt-1">查看所有学生的 AI 批改详情</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchRecords}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="刷新"
                    >
                        🔄
                    </button>
                    {/* 导出按钮 */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                        <span>📥</span> 导出 CSV
                    </button>
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 min-w-[200px]">
                    <span className="text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="搜索学生姓名..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-gray-900 placeholder-gray-400"
                    />
                </div>

                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                    <option value="all">所有日期</option>
                    <option value="today">今天</option>
                    <option value="week">最近7天</option>
                </select>
            </div>

            {/* 记录列表 */}
            <RecordsTable
                records={records}
                loading={loading}
                onViewDetail={(record) => setSelectedRecord(record)}
            />

            {/* 详情弹窗 */}
            {selectedRecord && (
                <RecordDetailModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div>
    );
}
