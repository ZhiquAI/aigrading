import React from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * StatusIndicator 组件
 * 用于显示状态指示器（成功/错误/警告/加载中）
 */

export type StatusType = 'success' | 'error' | 'warning' | 'loading' | 'idle';

interface StatusIndicatorProps {
    status: StatusType;
    label: string;
    onClick?: () => void;
    clickable?: boolean;
    className?: string;
}

const statusConfig: Record<StatusType, {
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
}> = {
    success: {
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        icon: <Check className="w-3 h-3" />,
    },
    error: {
        bgColor: 'bg-red-50',
        textColor: 'text-red-500',
        borderColor: 'border-red-200',
        icon: <X className="w-3 h-3" />,
    },
    warning: {
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-600',
        borderColor: 'border-orange-200',
        icon: <AlertTriangle className="w-3 h-3" />,
    },
    loading: {
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    idle: {
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-500',
        borderColor: 'border-gray-200',
        icon: null,
    },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
    status,
    label,
    onClick,
    clickable = false,
    className = '',
}) => {
    const config = statusConfig[status];

    const Component = clickable ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={`
        flex items-center px-2 py-1.5 rounded-md border text-[10px] font-medium 
        transition-colors flex-1 justify-center mx-0.5
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-offset-1' : ''}
        ${className}
      `}
        >
            {config.icon && <span className="mr-1.5">{config.icon}</span>}
            {label}
        </Component>
    );
};

export default StatusIndicator;
