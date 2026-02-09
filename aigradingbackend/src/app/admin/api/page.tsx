'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminCard from '../_components/AdminCard';

interface ApiProvider {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    status: 'unknown' | 'ok' | 'error';
    latency?: number;
}

const defaultProviders: ApiProvider[] = [
    { id: 'gptsapi', name: 'GPTSAPI (GPT-4o)', enabled: true, priority: 1, status: 'unknown' },
    { id: 'zhipu', name: '智谱 AI (GLM-4)', enabled: true, priority: 2, status: 'unknown' },
    { id: 'gemini', name: 'Gemini (Direct)', enabled: true, priority: 3, status: 'unknown' },
];

export default function ApiPage() {
    const [providers, setProviders] = useState<ApiProvider[]>(defaultProviders);
    const [testing, setTesting] = useState<string | null>(null);

    const testApi = async (id: string) => {
        setTesting(id);
        const start = Date.now();

        try {
            const res = await fetch('/api/admin/api-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: id }),
            });
            const data = await res.json();
            const latency = Date.now() - start;

            setProviders((prev) =>
                prev.map((p) =>
                    p.id === id
                        ? { ...p, status: data.success ? 'ok' : 'error', latency }
                        : p
                )
            );
        } catch {
            setProviders((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: 'error' } : p))
            );
        } finally {
            setTesting(null);
        }
    };

    const testAll = async () => {
        for (const p of providers.filter((p) => p.enabled)) {
            await testApi(p.id);
        }
    };

    const toggleProvider = (id: string) => {
        setProviders((prev) =>
            prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
        );
    };

    return (
        <div>
            <AdminPageHeader
                title="API 管理"
                actions={(
                    <button
                        onClick={testAll}
                        disabled={testing !== null}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                        type="button"
                    >
                        {testing ? '测试中…' : '一键检测'}
                    </button>
                )}
            />

            {/* API 列表 */}
            <div className="space-y-4">
                {providers.map((p) => (
                    <AdminCard
                        key={p.id}
                        className="p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div
                                    className={`w-3 h-3 rounded-full ${p.status === 'ok'
                                        ? 'bg-green-500'
                                        : p.status === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-gray-300'
                                        }`}
                                />
                                <div>
                                    <h3 className="text-gray-900 font-medium">{p.name}</h3>
                                    <p className="text-gray-500 text-sm">
                                        优先级: {p.priority}
                                        {p.latency && ` · 延迟: ${p.latency}ms`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => testApi(p.id)}
                                    disabled={testing !== null}
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-50"
                                    type="button"
                                >
                                    {testing === p.id ? '测试中…' : '测试'}
                                </button>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={p.enabled}
                                        onChange={() => toggleProvider(p.id)}
                                        className="sr-only peer"
                                        aria-label={`${p.name} 启用状态`}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* 状态信息 */}
                        <div className="flex gap-4 text-sm">
                            <span className="text-gray-500">
                                状态:{' '}
                                <span
                                    className={
                                        p.status === 'ok'
                                            ? 'text-green-600'
                                            : p.status === 'error'
                                                ? 'text-red-600'
                                                : 'text-gray-600'
                                    }
                                >
                                    {p.status === 'ok' ? '正常' : p.status === 'error' ? '异常' : '未知'}
                                </span>
                            </span>
                        </div>
                    </AdminCard>
                ))}
            </div>

            {/* 说明 */}
            <AdminCard className="mt-6 p-4 bg-amber-50 border-amber-200">
                <p className="text-amber-700 text-sm flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5" aria-hidden />
                    <span>提示：启用多个 API 后，系统会按优先级顺序尝试，当主 API 失败时自动切换到备用 API。</span>
                </p>
            </AdminCard>
        </div>
    );
}
