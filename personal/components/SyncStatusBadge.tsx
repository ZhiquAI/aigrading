/**
 * SyncStatusBadge.tsx - 同步状态指示器
 * 
 * 显示评分细则的同步状态
 */

import React from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-react';
import type { SyncStatus } from '../services/rubric-storage';

interface SyncStatusBadgeProps {
    status: SyncStatus;
    size?: 'sm' | 'md';
    showLabel?: boolean;
}

const statusConfig: Record<SyncStatus, {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
}> = {
    synced: {
        icon: <Check size={12} />,
        label: '已同步',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
    },
    syncing: {
        icon: <Loader2 size={12} className="animate-spin" />,
        label: '同步中',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
    },
    pending: {
        icon: <Cloud size={12} />,
        label: '待同步',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
    },
    error: {
        icon: <AlertCircle size={12} />,
        label: '同步失败',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
    },
};

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    status,
    size = 'sm',
    showLabel = false,
}) => {
    const config = statusConfig[status];

    const sizeClasses = size === 'sm'
        ? 'px-1.5 py-0.5 text-[10px]'
        : 'px-2 py-1 text-xs';

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-medium ${config.color} ${config.bgColor} ${sizeClasses}`}
            title={config.label}
        >
            {config.icon}
            {showLabel && <span>{config.label}</span>}
        </span>
    );
};

export default SyncStatusBadge;
