import React from 'react';

/**
 * EmptyState 组件
 * 用于显示空状态、无数据等场景
 */

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    features?: {
        icon: React.ReactNode;
        label: string;
    }[];
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    features,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-6 text-center ${className}`}>
            {/* 图标 */}
            {icon && (
                <div className="mb-6 animate-float">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center border border-blue-100">
                            {icon}
                        </div>
                    </div>
                </div>
            )}

            {/* 标题 */}
            <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>

            {/* 描述 */}
            {description && (
                <p className="text-sm text-gray-500 mb-6 max-w-[260px] leading-relaxed">
                    {description}
                </p>
            )}

            {/* 功能预览 */}
            {features && features.length > 0 && (
                <div className="w-full grid grid-cols-3 gap-2 mb-6">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-xl p-3 border border-gray-100 text-center"
                        >
                            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-50 flex items-center justify-center">
                                {feature.icon}
                            </div>
                            <span className="text-[10px] text-gray-500">{feature.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 操作按钮 */}
            {action && <div className="w-full">{action}</div>}
        </div>
    );
};

export default EmptyState;
