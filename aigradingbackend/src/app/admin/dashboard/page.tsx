'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/stats', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    }
                });
                const data = await res.json();
                if (data.success) {
                    setStats(data.data);
                }
            } catch (err) {
                console.error('Fetch stats error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="p-8 animate-pulse space-y-8">
                <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-gray-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">数据概览</h1>
                    <p className="text-gray-500 text-sm mt-1">欢迎回来，这是您的系统实时运行快照</p>
                </div>
                <div className="text-xs text-gray-400">
                    最后更新: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="今日批改"
                    value={stats?.todayUsage || 0}
                    icon="✍️"
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                />
                <StatCard
                    title="总激活码"
                    value={stats?.totalCodes || 0}
                    icon="🔑"
                    color="text-purple-600"
                    bgColor="bg-purple-50"
                />
                <StatCard
                    title="活跃配额"
                    value={Math.round(stats?.totalQuotaRemaining || 0)}
                    icon="🔋"
                    color="text-green-600"
                    bgColor="bg-green-50"
                />
                <StatCard
                    title="总阅卷量"
                    value={stats?.totalUsage || 0}
                    icon="📊"
                    color="text-orange-600"
                    bgColor="bg-orange-50"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 最近活动 */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">最近批改活动</h2>
                        <Link href="/admin/records" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">查看全部</Link>
                    </div>
                    {/* 活跃激活码排行 */}
                    <div className="bg-white border border-gray-200 rounded-[32px] overflow-hidden shadow-sm">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">活跃激活码排行</h2>
                                <p className="text-xs text-gray-400 mt-0.5">按累计使用次数排序的前 10 个激活码</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4">激活码</th>
                                        <th className="px-4 py-4">类型</th>
                                        <th className="px-4 py-4 text-right">已用 / 总额</th>
                                        <th className="px-8 py-4 text-right">使用率</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {stats?.topActiveCodes?.map((code: any) => (
                                        <tr key={code.code} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-4 font-mono font-medium text-gray-900">{code.code}</td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${code.type === 'pro' ? 'bg-purple-100 text-purple-600' :
                                                    code.type === 'standard' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {code.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right text-gray-600">
                                                <span className="font-medium text-gray-900">{code.used}</span>
                                                <span className="text-gray-400 mx-1">/</span>
                                                <span>{code.quota}</span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 transition-all"
                                                            style={{ width: `${Math.min(100, Math.round((code.used / code.quota) * 100))}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-bold tabular-nums w-8 text-right italic">
                                                        {Math.round((code.used / code.quota) * 100)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats?.topActiveCodes || stats.topActiveCodes.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-12 text-center text-gray-400">
                                                暂无活跃数据
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-400 font-medium">
                                <tr>
                                    <th className="px-6 py-4">学生</th>
                                    <th className="px-6 py-4">得分</th>
                                    <th className="px-6 py-4">激活码</th>
                                    <th className="px-6 py-4">时间</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats?.latestRecords?.map((record: any) => (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{record.studentName}</td>
                                        <td className="px-6 py-4 text-indigo-600 font-bold">{record.score} / {record.maxScore}</td>
                                        <td className="px-6 py-4"><span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{record.activationCode}</span></td>
                                        <td className="px-6 py-4 text-gray-400">{new Date(record.createdAt).toLocaleTimeString()}</td>
                                    </tr>
                                ))}
                                {(!stats?.latestRecords || stats.latestRecords.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">暂无活动</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* API 状态 */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">配额消耗统计</h2>
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                            {stats?.quotaStatsByType?.map((item: any) => (
                                <div key={item.type} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 font-medium capitalize">{item.type} ({item.count}个)</span>
                                        <span className="text-gray-400">{item.usageRate}% 已用</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-indigo-600 h-full transition-all duration-1000"
                                            style={{ width: `${item.usageRate}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400">
                                        <span>剩余: {item.remainingQuota}</span>
                                        <span>总额: {item.totalQuota}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">服务状态</h2>
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
                            <StatusItem label="Gemini API" status="online" delay="2.4s" />
                            <StatusItem label="智谱 GLM-4" status="online" delay="1.8s" />
                            <StatusItem label="SQLite DB" status="online" delay="2ms" />

                            <div className="pt-4 border-t border-gray-50 mt-4">
                                <Link href="/admin/api" className="block text-center text-sm font-medium py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                                    进阶 API 管理 →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, bgColor }: any) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
                </div>
                <div className={`${bgColor} ${color} w-12 h-12 rounded-xl flex items-center justify-center text-xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function StatusItem({ label, status, delay }: any) {
    return (
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">{delay}</span>
        </div>
    );
}
