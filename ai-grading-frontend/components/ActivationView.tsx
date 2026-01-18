/**
 * ActivationView.tsx - 激活码输入界面
 * 
 * 用于输入激活码激活会员功能
 */

import React, { useState } from 'react';
import {
    Key, ShoppingCart, Gift, X,
    CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { Button } from './ui';

interface ActivationViewProps {
    isOpen: boolean;
    onClose: () => void;
    onActivated?: (memberInfo: MemberInfo) => void;
    onPurchase?: () => void;
    onFreeTrial?: () => void;
}

export interface MemberInfo {
    type: 'month' | 'year' | 'permanent' | 'trial';
    expiresAt: string | null;
    activatedAt: string;
}

// 激活状态
type ActivationStatus = 'idle' | 'loading' | 'success' | 'error';

// 格式化激活码（自动添加分隔符）
const formatActivationCode = (value: string): string => {
    // 移除所有非字母数字字符
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 限制长度
    const limited = clean.slice(0, 14);

    // 添加分隔符 ZY-Y-XXXXXXXX
    if (limited.length <= 2) return limited;
    if (limited.length <= 3) return `${limited.slice(0, 2)}-${limited.slice(2)}`;
    return `${limited.slice(0, 2)}-${limited.slice(2, 3)}-${limited.slice(3)}`;
};

// 验证激活码格式
const isValidCodeFormat = (code: string): boolean => {
    // 格式：ZY-X-XXXXXXXX (2-1-8)
    return /^ZY-[MYTP]-[A-Z0-9]{8}$/.test(code);
};

export const ActivationView: React.FC<ActivationViewProps> = ({
    isOpen,
    onClose,
    onActivated,
    onPurchase,
    onFreeTrial
}) => {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<ActivationStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatActivationCode(e.target.value);
        setCode(formatted);
        setStatus('idle');
        setErrorMessage('');
    };

    const handleActivate = async () => {
        if (!isValidCodeFormat(code)) {
            setStatus('error');
            setErrorMessage('激活码格式不正确');
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            // TODO: 调用后端验证 API
            // const response = await fetch('/api/activation/verify', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ code })
            // });

            // 模拟验证（开发阶段）
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 模拟成功
            if (code.startsWith('ZY-')) {
                const typeMap: Record<string, MemberInfo['type']> = {
                    'M': 'month',
                    'Y': 'year',
                    'P': 'permanent',
                    'T': 'trial'
                };
                const codeType = code.charAt(3) as keyof typeof typeMap;

                const info: MemberInfo = {
                    type: typeMap[codeType] || 'month',
                    expiresAt: codeType === 'P' ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    activatedAt: new Date().toISOString()
                };

                setMemberInfo(info);
                setStatus('success');

                // 保存激活状态到本地
                localStorage.setItem('member_info', JSON.stringify(info));
                localStorage.setItem('activation_code', code);

                onActivated?.(info);
            } else {
                throw new Error('激活码无效');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(error instanceof Error ? error.message : '激活失败，请重试');
        }
    };

    const getMemberTypeLabel = (type: MemberInfo['type']) => {
        const labels = {
            month: '月度会员',
            year: '年度会员',
            permanent: '永久会员',
            trial: '试用会员'
        };
        return labels[type];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* 头部 */}
                <div className="relative px-6 pt-6 pb-4 text-center bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg mb-4">
                        <Key className="w-8 h-8 text-white" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
                        激活智阅AI
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        输入激活码，解锁全部功能
                    </p>
                </div>

                {/* 内容区 */}
                <div className="p-6">
                    {status === 'success' && memberInfo ? (
                        // 激活成功状态
                        <div className="text-center py-4">
                            <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                激活成功！
                            </h3>
                            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                <p>会员类型：<span className="font-medium text-blue-600">{getMemberTypeLabel(memberInfo.type)}</span></p>
                                {memberInfo.expiresAt && (
                                    <p>到期时间：{new Date(memberInfo.expiresAt).toLocaleDateString('zh-CN')}</p>
                                )}
                                {!memberInfo.expiresAt && (
                                    <p className="text-green-600 font-medium">永久有效</p>
                                )}
                            </div>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={onClose}
                                className="mt-6 w-full"
                            >
                                开始使用
                            </Button>
                        </div>
                    ) : (
                        // 输入状态
                        <>
                            {/* 激活码输入框 */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    激活码
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={handleCodeChange}
                                        placeholder="ZY-Y-XXXXXXXX"
                                        className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 text-center text-lg font-mono tracking-wider transition-colors ${status === 'error'
                                            ? 'border-red-300 bg-red-50 dark:bg-red-900/20 focus:border-red-500'
                                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:border-blue-500'
                                            } focus:outline-none dark:text-gray-100`}
                                        disabled={status === 'loading'}
                                    />
                                </div>
                                {status === 'error' && errorMessage && (
                                    <div className="flex items-center gap-1 mt-2 text-sm text-red-500">
                                        <AlertCircle className="w-4 h-4" />
                                        {errorMessage}
                                    </div>
                                )}
                            </div>

                            {/* 激活按钮 */}
                            <Button
                                variant="gradient"
                                size="md"
                                onClick={handleActivate}
                                disabled={!code || status === 'loading'}
                                loading={status === 'loading'}
                                icon={status === 'loading' ? undefined : <Sparkles className="w-5 h-5" />}
                                className="w-full shadow-lg shadow-blue-500/25"
                            >
                                {status === 'loading' ? '验证中...' : '立即激活'}
                            </Button>

                            {/* 分割线 */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-400">
                                        没有激活码?
                                    </span>
                                </div>
                            </div>

                            {/* 底部选项 */}
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={onPurchase}
                                    icon={<ShoppingCart className="w-4 h-4" />}
                                    className="w-full"
                                >
                                    购买激活码
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={onFreeTrial}
                                    icon={<Gift className="w-4 h-4" />}
                                    className="w-full"
                                >
                                    免费试用
                                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                                        300次
                                    </span>
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* 底部提示 */}
                {status !== 'success' && (
                    <div className="px-6 pb-4 text-center">
                        <p className="text-xs text-gray-400">
                            激活后可绑定账号，享受云端同步
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivationView;
