'use client';

import { useState } from 'react';
import AdminCard from '../../_components/AdminCard';

interface ActivationCode {
    id: string;
    code: string;
    type: string;
    quota: number;
    remaining: number;
    used: number;
    status: string;
    reusable: boolean;
    createdAt: string;
    expiresAt?: string;
}

interface CodeListProps {
    codes: ActivationCode[];
    loading: boolean;
    onRefresh: () => void;
}

export default function CodeList({ codes, loading, onRefresh }: CodeListProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === codes.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(codes.map(c => c.id));
        }
    };

    const handleBatchAction = async (action: 'delete' | 'enable' | 'disable') => {
        if (selectedIds.length === 0) return;
        if (action === 'delete' && !confirm(`确定要删除选中的 ${selectedIds.length} 个激活码吗？此操作不可撤销。`)) return;

        setBatchLoading(true);
        try {
            const res = await fetch('/api/admin/codes/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: JSON.stringify({ action, ids: selectedIds })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedIds([]);
                onRefresh();
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error('Batch action error:', err);
            alert('操作失败');
        } finally {
            setBatchLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCode(text);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'trial': return 'bg-gray-100 text-gray-600';
            case 'basic': return 'bg-blue-50 text-blue-600';
            case 'pro': return 'bg-purple-50 text-purple-600';
            case 'agency': return 'bg-orange-50 text-orange-600';
            default: return 'bg-gray-50 text-gray-600';
        }
    };

    const getStatusColor = (status: string, remaining: number) => {
        if (status === 'disabled') return 'bg-red-50 text-red-600';
        if (remaining <= 0) return 'bg-yellow-50 text-yellow-600';
        return 'bg-green-50 text-green-600';
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                ))}
            </div>
        );
    }

    if (codes.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500">暂无激活码，点击右上角生成</p>
            </div>
        );
    }

    return (
        <AdminCard className="overflow-hidden">
            {/* 批量操作工具栏 */}
            {selectedIds.length > 0 && (
                <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-indigo-900">
                            已选择 <span className="font-bold">{selectedIds.length}</span> 个激活码
                        </span>
                        <div className="h-4 w-px bg-indigo-200" />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleBatchAction('enable')}
                                disabled={batchLoading}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                            >
                                批量启用
                            </button>
                            <button
                                onClick={() => handleBatchAction('disable')}
                                disabled={batchLoading}
                                className="text-xs font-bold text-orange-600 hover:text-orange-700 disabled:opacity-50"
                            >
                                批量禁用
                            </button>
                            <button
                                onClick={() => handleBatchAction('delete')}
                                disabled={batchLoading}
                                className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                                批量删除
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        取消选择
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length > 0 && selectedIds.length === codes.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    aria-label="选择全部激活码"
                                />
                            </th>
                            <th className="px-6 py-4">激活码</th>
                            <th className="px-6 py-4">类型</th>
                            <th className="px-6 py-4">剩余/总额</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">创建时间</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {codes.map((code) => (
                            <tr key={code.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(code.id) ? 'bg-indigo-50/30' : ''}`}>
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(code.id)}
                                        onChange={() => toggleSelect(code.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        aria-label={`选择激活码 ${code.code}`}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-mono font-medium text-gray-900">{code.code}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(code.type)}`}>
                                        {code.type.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${(code.remaining / code.quota) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-gray-600 tabular-nums">
                                            {code.remaining}/{code.quota}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(code.status, code.remaining)}`}>
                                        {code.remaining <= 0 ? '已耗尽' : (code.status === 'active' ? '正常' : '已禁用')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 tabular-nums">
                                    {new Date(code.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => copyToClipboard(code.code)}
                                        className={`font-medium text-xs px-3 py-1.5 rounded-lg transition-all ${copiedCode === code.code
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'
                                            }`}
                                    >
                                        {copiedCode === code.code ? '已复制' : '复制'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminCard>
    );
}
