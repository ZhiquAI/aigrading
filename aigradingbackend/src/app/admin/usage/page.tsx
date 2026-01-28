'use client';

import { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';

// 注册 Chart.js 插件
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

type ViewMode = 'chart' | 'table';

export default function QuotaUsagePage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState('30');
    const [viewMode, setViewMode] = useState<ViewMode>('chart');

    // 表格视图状态
    const [tableData, setTableData] = useState<any>(null);
    const [tableLoading, setTableLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('used');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterType, setFilterType] = useState('all');
    const [searchCode, setSearchCode] = useState('');

    // 加载图表统计数据
    useEffect(() => {
        if (viewMode === 'table') return; // 表格模式不加载图表数据

        const fetchStats = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/quota/stats?days=${days}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                });
                const result = await res.json();
                if (result.success) {
                    setStats(result.data);
                }
            } catch (error) {
                console.error('Fetch quota stats error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [days, viewMode]);

    // 加载表格数据
    useEffect(() => {
        if (viewMode === 'chart') return; // 图表模式不加载表格数据

        const fetchTableData = async () => {
            setTableLoading(true);
            try {
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: '50',
                    sortBy,
                    sortOrder,
                    ...(filterType !== 'all' && { filterType }),
                    ...(searchCode && { search: searchCode })
                });

                const res = await fetch(`/api/admin/quota/by-code?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                });
                const result = await res.json();
                if (result.success) {
                    setTableData(result.data);
                }
            } catch (error) {
                console.error('Fetch table data error:', error);
            } finally {
                setTableLoading(false);
            }
        };
        fetchTableData();
    }, [page, sortBy, sortOrder, filterType, searchCode, viewMode]);

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
        setPage(1);
    };

    if (loading) {
        return <div className="p-8 animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="h-96 bg-gray-50 rounded-2xl" />
        </div>;
    }

    // 表格视图渲染
    if (viewMode === 'table') {
        return (
            <div className="space-y-6">
                {/* 标题栏 */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">激活码用量统计</h1>
                        <p className="text-gray-500 text-sm mt-1">按激活码查看详细使用情况</p>
                    </div>
                    <div className="flex gap-3">
                        {/* 视图切换 */}
                        <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${viewMode === 'chart' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                图表视图
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                表格视图
                            </button>
                        </div>
                    </div>
                </div>

                {/* 筛选栏 */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">全部类型</option>
                            <option value="trial">试用码</option>
                            <option value="basic">基础码</option>
                            <option value="standard">标准码</option>
                            <option value="pro">专业码</option>
                            <option value="permanent">永久码</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索激活码..."
                            value={searchCode}
                            onChange={(e) => { setSearchCode(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* 数据表格 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {[
                                        { key: 'code', label: '激活码' },
                                        { key: 'type', label: '类型' },
                                        { key: 'quota', label: '总配额' },
                                        { key: 'used', label: '已使用' },
                                        { key: 'remaining', label: '剩余' },
                                        { key: 'usageRate', label: '使用率' },
                                        { key: 'gradingCount', label: '批改数' },
                                        { key: 'rubricCount', label: '细则数' },
                                        { key: 'status', label: '状态' },
                                        { key: 'createdAt', label: '创建时间' },
                                    ].map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => ['code', 'type', 'quota', 'used', 'remaining', 'gradingCount', 'rubricCount', 'createdAt'].includes(col.key) ? handleSort(col.key) : null}
                                            className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${['code', 'type', 'quota', 'used', 'remaining', 'gradingCount', 'rubricCount', 'createdAt'].includes(col.key) ? 'cursor-pointer hover:bg-gray-100' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.label}
                                                {sortBy === col.key && (
                                                    sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tableLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={10} className="px-4 py-3">
                                                <div className="h-8 bg-gray-100 rounded" />
                                            </td>
                                        </tr>
                                    ))
                                ) : tableData?.list?.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                                            暂无数据
                                        </td>
                                    </tr>
                                ) : (
                                    tableData?.list?.map((code: any) => (
                                        <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-mono font-medium text-indigo-600">
                                                {code.code}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(code.type)}`}>
                                                    {code.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                {code.quota.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {code.used.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {code.remaining.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${parseFloat(code.usageRate) > 80 ? 'bg-red-500' : parseFloat(code.usageRate) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                                                }`}
                                                            style={{ width: `${code.usageRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-gray-600">{code.usageRate}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {code.gradingCount?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {code.rubricCount?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${code.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {code.status === 'active' ? '激活' : '禁用'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {new Date(code.createdAt).toLocaleDateString('zh-CN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 分页 */}
                    {tableData?.pagination && (
                        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                共 {tableData.pagination.total} 条记录
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                <span className="px-3 py-1.5 text-sm text-gray-600">
                                    第 {page} / {tableData.pagination.totalPages} 页
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= tableData.pagination.totalPages}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 类型颜色辅助函数
    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            trial: 'bg-purple-100 text-purple-700',
            basic: 'bg-blue-100 text-blue-700',
            standard: 'bg-green-100 text-green-700',
            pro: 'bg-orange-100 text-orange-700',
            permanent: 'bg-red-100 text-red-700',
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    // 趋势图数据 (消耗 vs 发放)
    const trendData = {
        labels: stats?.dailyStats?.map((d: any) => d.date.slice(5)) || [],
        datasets: [
            {
                label: '每日消耗 (批改数)',
                data: stats?.dailyStats?.map((d: any) => d.consumption) || [],
                borderColor: 'rgb(79, 70, 229)',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y',
            },
            {
                label: '每日发放 (额度)',
                data: stats?.dailyStats?.map((d: any) => d.issuance) || [],
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: false,
                tension: 0.4,
                borderDash: [5, 5],
                yAxisID: 'y1',
            }
        ],
    };

    // 类型分布数据
    const typeData = {
        labels: stats?.typeDistribution?.map((d: any) => d.type.toUpperCase()) || [],
        datasets: [
            {
                data: stats?.typeDistribution?.map((d: any) => d.totalQuota) || [],
                backgroundColor: [
                    'rgba(79, 70, 229, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)',
                ],
                borderWidth: 0,
            },
        ],
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">配额统计</h1>
                    <p className="text-gray-500 text-sm mt-1">监控激活码消耗速率与资源分配情况</p>
                </div>
                <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                    {['7', '30', '90'].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {d === '7' ? '最近7天' : d === '30' ? '最近30天' : '最近90天'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MiniCard title="总发放配额" value={stats?.summary?.totalIssued?.toLocaleString()} label="全系统总量" />
                <MiniCard title="已消耗配额" value={stats?.summary?.totalUsed?.toLocaleString()} label={`占比 ${Math.round((stats?.summary?.totalUsed / stats?.summary?.totalIssued) * 100) || 0}%`} color="text-indigo-600" />
                <MiniCard title="剩余总可用" value={stats?.summary?.totalRemaining?.toLocaleString()} label="全网存量" color="text-emerald-600" />
                <MiniCard title="日均消耗" value={Math.round(stats?.summary?.avgDailyConsumption || 0)} label="最近周期" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 趋势图 */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">消耗与发放趋势</h3>
                    <div className="h-80">
                        <Line
                            data={trendData}
                            options={{
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: { display: true, text: '消耗量', font: { size: 10 } }
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        grid: { drawOnChartArea: false },
                                        title: { display: true, text: '发放量', font: { size: 10 } }
                                    },
                                    x: { grid: { display: false } }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 配额构成 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 font-sans">配额构成 (总额)</h3>
                    <div className="h-64 flex items-center justify-center">
                        <Doughnut
                            data={typeData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } },
                                cutout: '70%'
                            }}
                        />
                    </div>
                    <div className="mt-4 space-y-2">
                        {stats?.typeDistribution?.map((d: any, i: number) => (
                            <div key={d.type} className="flex justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeData.datasets[0].backgroundColor[i] }} />
                                    {d.type.toUpperCase()}
                                </span>
                                <span className="font-mono">{d.totalQuota.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 消耗率分析 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">各卡型消耗分析</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats?.typeDistribution?.map((d: any) => (
                        <div key={d.type} className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="text-sm font-bold text-gray-900">{d.type.toUpperCase()}</span>
                                <span className="text-xs text-gray-400">已用 {Math.round((d.usedQuota / d.totalQuota) * 100) || 0}%</span>
                            </div>
                            <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full"
                                    style={{ width: `${(d.usedQuota / d.totalQuota) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 tabular-nums">
                                <span>USED: {d.usedQuota.toLocaleString()}</span>
                                <span>TOTAL: {d.totalQuota.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MiniCard({ title, value, label, color = "text-gray-900" }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{title}</p>
            <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
            <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {label}
            </p>
        </div>
    );
}
