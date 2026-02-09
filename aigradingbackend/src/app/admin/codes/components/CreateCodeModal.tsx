'use client';

import { useState } from 'react';
import { X, Sparkles, Zap, Crown, Building2, Check, Package, Users, Hash } from 'lucide-react';
import AdminModal from '../../_components/AdminModal';

interface CreateCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// 激活码类型配置
const CODE_TYPES = [
    {
        id: 'trial',
        name: '试用版',
        description: '适合新用户体验',
        quota: 20,
        icon: Sparkles,
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        selectedBorder: 'ring-gray-500'
    },
    {
        id: 'basic',
        name: '基础版',
        description: '适合个人教师使用',
        quota: 300,
        icon: Zap,
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        selectedBorder: 'ring-blue-500'
    },
    {
        id: 'pro',
        name: '专业版',
        description: '大批量批改需求',
        quota: 1000,
        icon: Crown,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        selectedBorder: 'ring-purple-500'
    },
    {
        id: 'agency',
        name: '机构版',
        description: '学校/机构多人共享',
        quota: 5000,
        icon: Building2,
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        selectedBorder: 'ring-amber-500'
    }
] as const;

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

    const selectedType = CODE_TYPES.find(t => t.id === formData.type) || CODE_TYPES[0];

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
        const typeConfig = CODE_TYPES.find(t => t.id === type);
        if (!typeConfig) return;

        const reusable = type === 'agency';
        const maxDevices = type === 'agency' ? 5 : 1;

        setFormData(prev => ({
            ...prev,
            type,
            quota: typeConfig.quota,
            reusable,
            maxDevices
        }));
    };

    return (
        <AdminModal isOpen={isOpen} onClose={onClose} ariaLabelledBy="create-code-title" maxWidthClassName="max-w-lg">
            {/* 渐变头部 */}
            <div className={`bg-gradient-to-r ${selectedType.color} px-6 py-5 rounded-t-2xl`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white" id="create-code-title">生成激活码</h2>
                            <p className="text-white/80 text-sm">为用户创建新的激活码</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        type="button"
                        aria-label="关闭"
                    >
                        <X className="w-4 h-4 text-white" aria-hidden />
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 scrollbar-thin scrollbar-thumb-gray-200">
                {/* 类型选择卡片 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">选择类型</label>
                    <div className="grid grid-cols-2 gap-2.5">
                        {CODE_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = formData.type === type.id;
                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => handleTypeChange(type.id)}
                                    className={`relative p-3.5 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? `${type.bgColor} ${type.borderColor} ring-2 ${type.selectedBorder}`
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {isSelected && (
                                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r ${type.color} flex items-center justify-center`}>
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${type.color} flex items-center justify-center mb-1.5`}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="font-semibold text-gray-900 text-sm">{type.name}</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{type.description}</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5 font-medium">默认 {type.quota} 次</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 配置区域 */}
                <div className="bg-gray-50/80 rounded-xl p-4 space-y-4 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                        <Hash className="w-3.5 h-3.5" />
                        详细配置
                    </div>

                    {/* 配额设置 */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label htmlFor="code-quota" className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">
                                批改次数配额
                            </label>
                            <div className="relative group">
                                <input
                                    id="code-quota"
                                    name="quota"
                                    type="number"
                                    value={formData.quota}
                                    onChange={(e) => setFormData({ ...formData, quota: Number(e.target.value) })}
                                    className="w-full pl-4 pr-12 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 font-medium
                                             focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold uppercase">次</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* 生成数量 */}
                        <div>
                            <label htmlFor="code-count" className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" />
                                生成数量
                            </label>
                            <input
                                id="code-count"
                                name="count"
                                type="number"
                                min="1"
                                max="50"
                                value={formData.count}
                                onChange={(e) => setFormData({ ...formData, count: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 font-medium
                                         focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                            />
                        </div>
                        {/* 最大设备数 */}
                        <div>
                            <label htmlFor="code-max-devices" className="block text-xs font-medium text-gray-500 mb-1.5 ml-1 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                设备上限
                            </label>
                            <input
                                id="code-max-devices"
                                name="maxDevices"
                                type="number"
                                min="1"
                                value={formData.maxDevices}
                                onChange={(e) => setFormData({ ...formData, maxDevices: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 font-medium
                                         focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* 可重用选项 */}
                    <label
                        htmlFor="reusable"
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-pointer
                                   hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                    >
                        <input
                            type="checkbox"
                            id="reusable"
                            checked={formData.reusable}
                            onChange={(e) => setFormData({ ...formData, reusable: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <div>
                            <div className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">允许多人共享</div>
                            <div className="text-[11px] text-gray-400">适用于班级或机构批量分发</div>
                        </div>
                    </label>
                </div>

                {/* 预览提示 */}
                <div className={`${selectedType.bgColor} rounded-xl p-3.5 border ${selectedType.borderColor} border-dashed`}>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">准备就绪</div>
                    <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        将生成 {formData.count} 个 {selectedType.name} 码，配额 {formData.quota} 次
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl 
                                   font-semibold text-sm transition-all"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`flex-1 px-4 py-3 text-white bg-gradient-to-r ${selectedType.color} 
                                   rounded-xl font-bold text-sm transition-all hover:translate-y-[-1px] active:translate-y-[1px]
                                   hover:shadow-lg hover:shadow-indigo-500/25 
                                   disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                正在处理...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                立即生成激活码
                            </>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
