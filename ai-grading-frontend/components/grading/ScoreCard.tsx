/**
 * ScoreCard.tsx - 评分结果卡片
 * 
 * 从 GradingView.tsx 拆分
 * 显示 AI 批改结果和评分详情
 */

import React from 'react';
import { Check, X, Edit2, ChevronDown, ChevronUp } from 'lucide-react';

interface BreakdownItem {
    label: string;
    score: number;
    max: number;
    comment?: string;
    isNegative?: boolean;
}

interface ScoreCardProps {
    studentName?: string;
    score: number;
    maxScore: number;
    comment?: string;
    breakdown?: BreakdownItem[];
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onAccept?: () => void;
    onReject?: () => void;
    onEdit?: () => void;
    showActions?: boolean;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
    studentName,
    score,
    maxScore,
    comment,
    breakdown = [],
    isExpanded = false,
    onToggleExpand,
    onAccept,
    onReject,
    onEdit,
    showActions = true
}) => {
    const scoreRate = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const isFullScore = score >= maxScore && maxScore > 0;

    const getScoreColor = () => {
        if (scoreRate >= 80) return 'text-green-600';
        if (scoreRate >= 60) return 'text-blue-600';
        if (scoreRate >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBgColor = () => {
        if (scoreRate >= 80) return 'bg-green-50 border-green-200';
        if (scoreRate >= 60) return 'bg-blue-50 border-blue-200';
        if (scoreRate >= 40) return 'bg-yellow-50 border-yellow-200';
        return 'bg-red-50 border-red-200';
    };

    return (
        <div className={`rounded-xl border-2 overflow-hidden ${getScoreBgColor()}`}>
            {/* 头部：分数显示 */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    {studentName && (
                        <span className="text-sm font-medium text-gray-700">{studentName}</span>
                    )}
                    <div className="flex items-center gap-1">
                        <span className={`text-3xl font-black ${getScoreColor()}`}>{score}</span>
                        <span className="text-lg text-gray-400">/{maxScore}</span>
                    </div>
                </div>

                {/* 进度条 */}
                <div className="h-2 bg-white/50 rounded-full overflow-hidden mb-2">
                    <div
                        className={`h-full transition-all duration-500 rounded-full ${isFullScore ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${Math.min(scoreRate, 100)}%` }}
                    />
                </div>

                {/* 评语 */}
                {comment && (
                    <p className="text-sm text-gray-600 mb-3">{comment}</p>
                )}

                {/* 操作按钮 */}
                {showActions && (
                    <div className="flex gap-2">
                        {onAccept && (
                            <button
                                onClick={onAccept}
                                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                            >
                                <Check className="w-4 h-4" />
                                确认
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                        {onReject && (
                            <button
                                onClick={onReject}
                                className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 评分详情展开区 */}
            {breakdown.length > 0 && (
                <>
                    <button
                        onClick={onToggleExpand}
                        className="w-full py-2 px-4 bg-white/30 border-t border-white/50 flex items-center justify-center gap-1 text-xs text-gray-500 hover:bg-white/50 transition-colors"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-3 h-3" />
                                收起详情
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                查看详情 ({breakdown.length}项)
                            </>
                        )}
                    </button>

                    {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                            {breakdown.map((item, idx) => (
                                <BreakdownItemCard key={idx} item={item} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// 单个得分点卡片
const BreakdownItemCard: React.FC<{ item: BreakdownItem }> = ({ item }) => {
    const isFull = item.score === item.max;
    const isZero = item.score === 0;
    const percent = item.max > 0 ? (item.score / item.max) * 100 : 0;

    const colorTheme = isFull
        ? { bg: 'bg-green-50', border: 'border-green-100', bar: 'bg-green-500', score: 'text-green-600' }
        : isZero
            ? { bg: 'bg-red-50', border: 'border-red-100', bar: 'bg-red-400', score: 'text-red-600' }
            : { bg: 'bg-orange-50', border: 'border-orange-100', bar: 'bg-orange-400', score: 'text-orange-600' };

    return (
        <div className={`p-2.5 rounded-lg ${colorTheme.bg} border ${colorTheme.border}`}>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                <div className="flex items-center">
                    <span className={`font-mono text-xs font-bold ${colorTheme.score}`}>{item.score}</span>
                    <span className="text-[10px] text-gray-400 ml-0.5">/{item.max}</span>
                </div>
            </div>
            <div className="h-1 bg-white rounded-full overflow-hidden mb-1">
                <div
                    className={`h-full ${colorTheme.bar} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            {item.comment && (
                <p className="text-[10px] text-gray-600 leading-relaxed">{item.comment}</p>
            )}
        </div>
    );
};

export default ScoreCard;
