import React from 'react';

/**
 * Badge 组件
 * 用于显示标签、状态等小型信息块
 */

export type BadgeVariant = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray' | 'success' | 'warning';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
};

export const Badge: React.FC<BadgeProps> = ({
    variant = 'blue',
    size = 'md',
    icon,
    children,
    className = '',
}) => {
    return (
        <span
            className={`
        inline-flex items-center rounded-full font-medium border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
        >
            {icon && <span className="mr-1">{icon}</span>}
            {children}
        </span>
    );
};

export default Badge;
