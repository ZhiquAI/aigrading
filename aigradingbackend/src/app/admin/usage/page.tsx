'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { Line, Doughnut } from 'react-chartjs-2';
import { ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';
import AdminCard from '../_components/AdminCard';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFilterBar from '../_components/AdminFilterBar';

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

type SortableColumn =
    | 'code'
    | 'type'
    | 'quota'
    | 'used'
    | 'remaining'
    | 'gradingCount'
    | 'rubricCount'
    | 'createdAt';

const SORTABLE_COLUMNS: SortableColumn[] = [
    'code',
    'type',
    'quota',
    'used',
    'remaining',
    'gradingCount',
    'rubricCount',
    'createdAt',
];

const DEFAULT_SORT: SortableColumn = 'used';
const DEFAULT_SORT_ORDER: 'asc' | 'desc' = 'desc';
const DEFAULT_DAYS = '30';
const ALLOWED_DAYS = ['7', '30', '90'];
const ALLOWED_TYPES = ['all', 'trial', 'basic', 'standard', 'pro', 'permanent'];

function QuotaUsagePageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(() => {
        const initial = searchParams.get('days') ?? DEFAULT_DAYS;
        return ALLOWED_DAYS.includes(initial) ? initial : DEFAULT_DAYS;
    });
    const [viewMode, setViewMode] = useState<ViewMode>(() =>
        searchParams.get('view') === 'table' ? 'table' : 'chart'
    );

    // 表格视图状态
    const [tableData, setTableData] = useState<any>(null);
    const [tableLoading, setTableLoading] = useState(false);
    const [page, setPage] = useState(() => {
        const value = Number(searchParams.get('page') ?? 1);
        return Number.isFinite(value) && value > 0 ? value : 1;
    });
    const [sortBy, setSortBy] = useState<SortableColumn>(() => {
        const value = searchParams.get('sort') as SortableColumn | null;
        return value && SORTABLE_COLUMNS.includes(value) ? value : DEFAULT_SORT;
    });
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
        const value = searchParams.get('order');
        return value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_ORDER;
    });
    const [filterType, setFilterType] = useState(() => {
        const value = searchParams.get('type') ?? 'all';
        return ALLOWED_TYPES.includes(value) ? value : 'all';
    });
    const [searchCode, setSearchCode] = useState(() => searchParams.get('q') ?? '');

    useEffect(() => {
        const view = searchParams.get('view') === 'table' ? 'table' : 'chart';
        const daysParam = searchParams.get('days') ?? DEFAULT_DAYS;
        const daysValue = ALLOWED_DAYS.includes(daysParam) ? daysParam : DEFAULT_DAYS;
        const pageParam = Number(searchParams.get('page') ?? 1);
        const pageValue = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
        const sortParam = searchParams.get('sort') as SortableColumn | null;
        const sortValue = sortParam && SORTABLE_COLUMNS.includes(sortParam) ? sortParam : DEFAULT_SORT;
        const orderParam = searchParams.get('order');
        const orderValue = orderParam === 'asc' || orderParam === 'desc' ? orderParam : DEFAULT_SORT_ORDER;
        const typeParam = searchParams.get('type') ?? 'all';
        const typeValue = ALLOWED_TYPES.includes(typeParam) ? typeParam : 'all';
        const queryValue = searchParams.get('q') ?? '';

        if (view !== viewMode) setViewMode(view);
        if (daysValue !== days) setDays(daysValue);
        if (pageValue !== page) setPage(pageValue);
        if (sortValue !== sortBy) setSortBy(sortValue);
        if (orderValue !== sortOrder) setSortOrder(orderValue);
        if (typeValue !== filterType) setFilterType(typeValue);
        if (queryValue !== searchCode) setSearchCode(queryValue);
    }, [searchParams, viewMode, days, page, sortBy, sortOrder, filterType, searchCode]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (viewMode !== 'chart') params.set('view', viewMode);
        if (days !== DEFAULT_DAYS) params.set('days', days);
        if (page !== 1) params.set('page', page.toString());
        if (sortBy !== DEFAULT_SORT) params.set('sort', sortBy);
        if (sortOrder !== DEFAULT_SORT_ORDER) params.set('order', sortOrder);
        if (filterType !== 'all') params.set('type', filterType);
        if (searchCode) params.set('q', searchCode);

        const next = params.toString();
        const current = searchParams.toString();
        if (next !== current) {
            router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
        }
    }, [viewMode, days, page, sortBy, sortOrder, filterType, searchCode, searchParams, router, pathname]);

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

    const handleSort = (column: SortableColumn) => {
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
                <AdminPageHeader
                    title="激活码用量统计"
                    subtitle="按激活码查看详细使用情况"
                    actions={(
                        <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('chart')}
                                className="px-4 py-2 text-xs font-medium rounded-md transition-colors text-gray-500 hover:text-gray-700"
                                type="button"
                                aria-pressed={false}
                            >
                                图表视图
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className="px-4 py-2 text-xs font-medium rounded-md transition-colors bg-indigo-600 text-white shadow-sm"
                                type="button"
                                aria-pressed={true}
                            >
                                表格视图
                            </button>
                        </div>
                    )}
                />

                <AdminFilterBar>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" aria-hidden />
                        <label htmlFor="quota-filter" className="sr-only">按类型筛选</label>
                        <select
                            id="quota-filter"
                            value={filterType}
                            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label="按类型筛选"
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
                        <Search className="w-4 h-4 text-gray-400" aria-hidden />
                        <label htmlFor="quota-search" className="sr-only">搜索激活码</label>
                        <input
                            id="quota-search"
                            name="searchCode"
                            type="text"
                            placeholder="搜索激活码…"
                            value={searchCode}
                            onChange={(e) => { setSearchCode(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoComplete="off"
                            aria-label="搜索激活码"
                        />
                    </div>
                </AdminFilterBar>

                <AdminCard dense className="overflow-hidden">
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
                                    ].map((col) => {
                                        const isSortable = SORTABLE_COLUMNS.includes(col.key as SortableColumn);
                                        const isActive = sortBy === col.key;
                                        const ariaSort = isSortable
                                            ? isActive
                                                ? sortOrder === 'asc'
                                                    ? 'ascending'
                                                    : 'descending'
                                                : 'none'
                                            : undefined;

                                        return (
                                            <th
                                                key={col.key}
                                                aria-sort={ariaSort}
                                                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                                            >
                                                {isSortable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSort(col.key as SortableColumn)}
                                                        className="flex items-center gap-1 cursor-pointer hover:text-gray-900"
                                                    >
                                                        {col.label}
                                                        {isActive && (
                                                            sortOrder === 'asc'
                                                                ? <ChevronUp className="w-3 h-3" aria-hidden />
                                                                : <ChevronDown className="w-3 h-3" aria-hidden />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span>{col.label}</span>
                                                )}
                                            </th>
                                        );
                                    })}
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
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium tabular-nums">
                                                {code.quota.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                                                {code.used.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
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
                                                    <span className="text-gray-600 tabular-nums">{code.usageRate}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                                                {code.gradingCount?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                                                {code.rubricCount?.toLocaleString() || 0}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${code.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {code.status === 'active' ? '激活' : '禁用'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">
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
                                    type="button"
                                >
                                    上一页
                                </button>
                                <span className="px-3 py-1.5 text-sm text-gray-600 tabular-nums">
                                    第 {page} / {tableData.pagination.totalPages} 页
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= tableData.pagination.totalPages}
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="button"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </AdminCard>
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
            <AdminPageHeader
                title="配额统计"
                subtitle="监控激活码消耗速率与资源分配情况"
                actions={(
                    <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                        {['7', '30', '90'].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                type="button"
                                aria-pressed={days === d}
                            >
                                {d === '7' ? '最近7天' : d === '30' ? '最近30天' : '最近90天'}
                            </button>
                        ))}
                    </div>
                )}
            />

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MiniCard title="总发放配额" value={stats?.summary?.totalIssued?.toLocaleString()} label="全系统总量" />
                <MiniCard title="已消耗配额" value={stats?.summary?.totalUsed?.toLocaleString()} label={`占比 ${Math.round((stats?.summary?.totalUsed / stats?.summary?.totalIssued) * 100) || 0}%`} color="text-indigo-600" />
                <MiniCard title="剩余总可用" value={stats?.summary?.totalRemaining?.toLocaleString()} label="全网存量" color="text-emerald-600" />
                <MiniCard title="日均消耗" value={Math.round(stats?.summary?.avgDailyConsumption || 0)} label="最近周期" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 趋势图 */}
                <AdminCard className="lg:col-span-2 p-6">
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
                </AdminCard>

                {/* 配额构成 */}
                <AdminCard className="p-6">
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
                            <div key={d.type} className="flex justify-between text-xs text-gray-500 tabular-nums">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeData.datasets[0].backgroundColor[i] }} />
                                    {d.type.toUpperCase()}
                                </span>
                                <span className="font-mono">{d.totalQuota.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </AdminCard>
            </div>

            {/* 消耗率分析 */}
            <AdminCard className="p-8 rounded-3xl">
                <h3 className="text-lg font-bold text-gray-900 mb-6">各卡型消耗分析</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats?.typeDistribution?.map((d: any) => (
                        <div key={d.type} className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="text-sm font-bold text-gray-900">{d.type.toUpperCase()}</span>
                                <span className="text-xs text-gray-400 tabular-nums">已用 {Math.round((d.usedQuota / d.totalQuota) * 100) || 0}%</span>
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
            </AdminCard>
        </div>
    );
}

function MiniCard({
    title,
    value,
    label,
    color = 'text-gray-900',
}: {
    title: string;
    value?: string | number;
    label: string;
    color?: string;
}) {
    return (
        <AdminCard className="p-6">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{title}</p>
            <div className={`text-2xl font-black mt-1 ${color} tabular-nums`}>{value}</div>
            <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {label}
            </p>
        </AdminCard>
    );
}

export default function QuotaUsagePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}>
            <QuotaUsagePageContent />
        </Suspense>
    );
}

