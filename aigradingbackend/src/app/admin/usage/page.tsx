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

    useEffect(() => {
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
    }, [days]);

    if (loading) {
        return <div className="p-8 animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="h-96 bg-gray-50 rounded-2xl" />
        </div>;
    }

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
