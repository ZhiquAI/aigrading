'use client';

import { useState } from 'react';

interface CreateCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateCodeModal({ isOpen, onClose, onSuccess }: CreateCodeModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'trial',
        quota: 20,
        count: 1,
        reusable: false,
        maxDevices: 1
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 批量生成
            for (let i = 0; i < formData.count; i++) {
                const res = await fetch('/api/admin/codes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                    },
                    body: JSON.stringify({
                        type: formData.type,
                        quota: Number(formData.quota),
                        reusable: formData.reusable,
                        maxDevices: Number(formData.maxDevices)
                    })
                });

                if (!res.ok) throw new Error('生成失败');
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Create error:', error);
            alert('生成失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleTypeChange = (type: string) => {
        // 根据类型自动设置默认配额
        let defaultQuota = 20;
        let reusable = false;
        let maxDevices = 1;

        switch (type) {
            case 'trial':
                defaultQuota = 20;
                break;
            case 'basic':
                defaultQuota = 300;
                break;
            case 'pro':
                defaultQuota = 1000;
                break;
            case 'agency':
                defaultQuota = 5000;
                reusable = true;
                maxDevices = 5;
                break;
        }

        setFormData(prev => ({
            ...prev,
            type,
            quota: defaultQuota,
            reusable,
            maxDevices
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">生成激活码</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 类型选择 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                        <select
                            value={formData.type}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                            <option value="trial">📝 试用版 (Trial)</option>
                            <option value="basic">⭐ 基础版 (Basic)</option>
                            <option value="pro">🚀 专业版 (Pro)</option>
                            <option value="agency">🏢 机构版 (Agency)</option>
                        </select>
                    </div>

                    {/* 配额设置 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">配额 (次)</label>
                        <input
                            type="number"
                            value={formData.quota}
                            onChange={(e) => setFormData({ ...formData, quota: Number(e.target.value) })}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 生成数量 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">生成数量</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={formData.count}
                                onChange={(e) => setFormData({ ...formData, count: Number(e.target.value) })}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        {/* 最大设备数 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">最大设备数</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.maxDevices}
                                onChange={(e) => setFormData({ ...formData, maxDevices: Number(e.target.value) })}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* 可重用选项 */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="reusable"
                            checked={formData.reusable}
                            onChange={(e) => setFormData({ ...formData, reusable: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="reusable" className="text-sm text-gray-600">
                            允许多人使用 (机构版/班级码)
                        </label>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? '生成中...' : '确认生成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
