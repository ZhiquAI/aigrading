import React from 'react';
import { ArrowLeft, Eye } from 'lucide-react';

interface StickyHeaderProps {
    totalScore: number;
    currentScore: number;
    onBack: () => void;
    onViewSource?: () => void;
}

/**
 * StickyHeader - 固定顶部栏
 * 显示返回按钮、总分统计、原图预览按钮
 */
const StickyHeader: React.FC<StickyHeaderProps> = ({
    totalScore,
    currentScore,
    onBack,
    onViewSource
}) => {
    return (
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="返回"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="font-bold text-gray-800">
                    总分: {currentScore}/{totalScore}
                </span>
            </div>
            {onViewSource && (
                <button
                    onClick={onViewSource}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                >
                    <Eye className="w-4 h-4" />
                    原图
                </button>
            )}
        </header>
    );
};

export default StickyHeader;
