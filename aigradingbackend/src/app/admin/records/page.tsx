'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Search } from 'lucide-react';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFilterBar from '../_components/AdminFilterBar';
import { adminTokens } from '../_styles/tokens';
import RecordsTable from './components/RecordsTable';
import RecordDetailModal from './components/RecordDetailModal';

function RecordsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
    const [dateRange, setDateRange] = useState(() => searchParams.get('range') ?? 'all'); // all, today, week

    useEffect(() => {
        const q = searchParams.get('q') ?? '';
        const range = searchParams.get('range') ?? 'all';
        if (q !== searchTerm) setSearchTerm(q);
        if (range !== dateRange) setDateRange(range);
    }, [searchParams, searchTerm, dateRange]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (dateRange !== 'all') params.set('range', dateRange);
        const next = params.toString();
        const current = searchParams.toString();
        if (next !== current) {
            router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
        }
    }, [searchTerm, dateRange, searchParams, router, pathname]);

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
        <div className={adminTokens.page}>
            <AdminPageHeader
                title="批改记录"
                subtitle="查看所有学生的 AI 批改详情"
                actions={(
                    <>
                        <button
                            onClick={fetchRecords}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="刷新"
                            aria-label="刷新记录"
                            type="button"
                        >
                            <RefreshCw className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
                            type="button"
                        >
                            <Download className="w-4 h-4" aria-hidden />
                            导出 CSV
                        </button>
                    </>
                )}
            />

            <AdminFilterBar>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 min-w-[200px]">
                    <label htmlFor="record-search" className="sr-only">搜索学生姓名</label>
                    <Search className="w-4 h-4 text-gray-400" aria-hidden />
                    <input
                        id="record-search"
                        name="studentName"
                        type="text"
                        placeholder="搜索学生姓名…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-gray-900 placeholder-gray-400"
                        autoComplete="off"
                        aria-label="搜索学生姓名"
                    />
                </div>

                <div className="flex items-center">
                    <label htmlFor="record-date-range" className="sr-only">日期范围</label>
                    <select
                        id="record-date-range"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                        aria-label="按日期筛选"
                    >
                        <option value="all">所有日期</option>
                        <option value="today">今天</option>
                        <option value="week">最近7天</option>
                    </select>
                </div>
            </AdminFilterBar>

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

export default function RecordsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}>
            <RecordsPageContent />
        </Suspense>
    );
}
