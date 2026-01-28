/**
 * MembershipCard.tsx - 会员状态卡片
 * 
 * 显示在设置页，展示会员状态和激活入口
 */

import React, { useState, useEffect } from 'react';
import {
    Crown, Gift, Clock, CheckCircle2,
    ChevronRight, Key, Sparkles
} from 'lucide-react';
import { getUsageInfo as fetchUsageFromBackend } from '@/services/proxyService';
import { Button } from './ui';

interface MemberInfo {
    type: 'month' | 'year' | 'permanent' | 'trial' | 'free';
    expiresAt: string | null;
    activatedAt?: string;
}

interface UsageInfo {
    used: number;
    limit: number;
    remaining: number;
}

interface MembershipCardProps {
    onActivate: () => void;
    onPurchase: () => void;
}

// 获取会员信息
const getMemberInfo = (): MemberInfo => {
    try {
        const saved = localStorage.getItem('member_info');
        if (saved) {
            const info = JSON.parse(saved);
            // 检查是否过期
            if (info.expiresAt && new Date(info.expiresAt) < new Date()) {
                localStorage.removeItem('member_info');
                return { type: 'free', expiresAt: null };
            }
            return info;
        }
    } catch {
        // ignore
    }
    return { type: 'free', expiresAt: null };
};

export const MembershipCard: React.FC<MembershipCardProps> = ({
    onActivate,
    onPurchase
}) => {
    const [memberInfo, setMemberInfo] = useState<MemberInfo>(getMemberInfo);
    const [usageInfo, setUsageInfo] = useState<UsageInfo>({ used: 0, limit: 300, remaining: 300 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 从后端获取真实配额
        const loadUsage = async () => {
            try {
                const data = await fetchUsageFromBackend();
                setUsageInfo({
                    used: data.todayUsage || 0,
                    limit: data.remaining === -1 ? -1 : data.remaining + (data.todayUsage || 0),
                    remaining: data.remaining
                });
                // 如果是无限次数，标记为会员
                if (data.remaining === -1 || data.isActivated) {
                    setMemberInfo(prev => ({ ...prev, type: 'permanent' }));
                }
            } catch (e) {
                console.error('Failed to fetch usage:', e);
                // 回退到默认值
                setUsageInfo({ used: 0, limit: 300, remaining: 300 });
            } finally {
                setIsLoading(false);
            }
        };

        loadUsage();

        // 监听存储变化
        const handleStorage = () => {
            setMemberInfo(getMemberInfo());
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const isPremium = memberInfo.type !== 'free';
    const isExpiringSoon = memberInfo.expiresAt &&
        new Date(memberInfo.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

    const getMemberLabel = () => {
        const labels: Record<string, string> = {
            free: '免费版',
            trial: '试用会员',
            month: '月度会员',
            year: '年度会员',
            permanent: '永久会员'
        };
        return labels[memberInfo.type] || '免费版';
    };

    const getMemberIcon = () => {
        if (isPremium) {
            return <Crown className="w-5 h-5 text-amber-500" />;
        }
        return <Gift className="w-5 h-5 text-blue-500" />;
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {getMemberIcon()}
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {getMemberLabel()}
                    </span>
                    {isPremium && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full">
                            已激活
                        </span>
                    )}
                </div>
            </div>

            {/* 内容 */}
            {isPremium ? (
                // 已激活状态
                <div className="space-y-2">
                    {memberInfo.expiresAt ? (
                        <div className={`flex items-center gap-2 text-sm ${isExpiringSoon
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-600 dark:text-gray-400'
                            }`}>
                            <Clock className="w-4 h-4" />
                            <span>
                                到期时间：{new Date(memberInfo.expiresAt).toLocaleDateString('zh-CN')}
                                {isExpiringSoon && ' (即将到期)'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>永久有效</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Sparkles className="w-4 h-4" />
                        <span>无限次批改 · 云端同步</span>
                    </div>

                    {isExpiringSoon && (
                        <button
                            onClick={onPurchase}
                            className="mt-2 w-full py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                        >
                            续费会员
                        </button>
                    )}
                </div>
            ) : (
                // 免费状态 - 简化版
                <div className="space-y-3">
                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                        <Button
                            variant="gradient"
                            size="sm"
                            onClick={onActivate}
                            icon={<Key className="w-4 h-4" />}
                            className="flex-1"
                        >
                            输入激活码
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onPurchase}
                            className="flex-1"
                        >
                            升级
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MembershipCard;
