import React from 'react';

/**
 * Card 组件
 * 统一的卡片容器组件
 */

export type CardVariant = 'default' | 'bordered' | 'gradient';

interface CardProps {
    variant?: CardVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    children: React.ReactNode;
}

interface CardHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

const variantStyles: Record<CardVariant, string> = {
    default: 'bg-white shadow-md border border-gray-100',
    bordered: 'bg-white border border-gray-200',
    gradient: 'bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white',
};

const paddingStyles: Record<string, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
};

export const Card: React.FC<CardProps> = ({
    variant = 'default',
    padding = 'md',
    className = '',
    children,
}) => {
    return (
        <div
            className={`
        rounded-xl overflow-hidden
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
        >
            {children}
        </div>
    );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
    title,
    subtitle,
    icon,
    action,
    className = '',
}) => {
    return (
        <div className={`flex items-center justify-between mb-3 ${className}`}>
            <div className="flex items-center gap-2">
                {icon && <span className="text-blue-500">{icon}</span>}
                <div>
                    <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                    {subtitle && <p className="text-[10px] text-gray-500">{subtitle}</p>}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
    );
};

export default Card;
