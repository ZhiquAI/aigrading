import React, { useState, useEffect } from 'react';
import { checkQuota } from '../services/cloudbaseService';
import { getDeviceId } from '../utils/device';

interface QuotaDisplayProps {
    onPurchaseClick?: () => void;
    onActivateClick?: () => void;
    variant?: 'default' | 'mini';
}

export default function QuotaDisplay({ onPurchaseClick, onActivateClick, variant = 'default' }: QuotaDisplayProps) {
    const [quota, setQuota] = useState({ remaining: 0, total: 0, used: 0 });
    const [loading, setLoading] = useState(true);

    const fetchQuota = async () => {
        try {
            const deviceId = getDeviceId();
            const result = await checkQuota(deviceId);

            setQuota({
                remaining: result.remaining || 0,
                total: result.total || 0,
                used: result.used || 0
            });
        } catch (error) {
            console.error('[QuotaDisplay] 获取额度失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuota();

        // 定时刷新（降低频率到60秒）
        const interval = setInterval(fetchQuota, 60000);

        // 监听额度更新事件（批改后触发）- 添加防抖
        let debounceTimer: NodeJS.Timeout;
        const handleQuotaUpdate = () => {
            console.log('[QuotaDisplay] Quota updated event received');

            // 防抖：500ms内只执行一次
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('[QuotaDisplay] Refreshing quota...');
                fetchQuota();
            }, 500);
        };

        window.addEventListener('quota_updated', handleQuotaUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('quota_updated', handleQuotaUpdate);
            clearTimeout(debounceTimer);
        };
    }, []);

    // 额度百分比
    const percentage = quota.total > 0 ? (quota.remaining / quota.total) * 100 : 0;

    // 额度状态
    const getStatusBadge = () => {
        if (percentage > 50) return { text: '充足', color: 'bg-green-100 text-green-700' };
        if (percentage > 20) return { text: '额度偏低', color: 'bg-orange-100 text-orange-700' };
        return { text: '需要充值', color: 'bg-red-100 text-red-700' };
    };

    const status = getStatusBadge();

    if (loading) {
        return variant === 'mini' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700 animate-pulse">
                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="w-6 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        ) : (
            <div className="bg-white rounded-xl p-4 shadow-card border border-gray-100">
                <div className="flex items-center justify-center gap-2 py-4">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500">加载中...</span>
                </div>
            </div>
        );
    }

    if (variant === 'mini') {
        const isUnlimited = quota.total === -1 || quota.remaining === -1;
        return (
            <button
                onClick={quota.total === 0 ? onActivateClick : onPurchaseClick}
                className="flex items-center gap-1.5 pl-3 pr-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${percentage > 20 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 font-mono">
                    {isUnlimited ? '∞' : quota.remaining}
                </span>
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </button>
        );
    }

    return (
        <button
            onClick={quota.total === 0 ? onActivateClick : onPurchaseClick}
            className="w-full py-3.5 text-sm transition-all border-b-2 rounded-t-lg font-medium text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
            <div className="flex items-center justify-center gap-1.5">
                <span className="text-3xl font-black text-blue-600 tracking-tight">{quota.remaining}</span>
                <span className="text-lg text-slate-300 mx-1">/</span>
                <span className="text-lg font-bold text-slate-400">{quota.total}</span>
                <span className="px-2.5 py-0.5 bg-blue-600 text-white text-sm rounded-full font-bold ml-1">
                    {quota.total === 0 ? '激活' : '充值'}
                </span>
            </div>
        </button>
    );
}
