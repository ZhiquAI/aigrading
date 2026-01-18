/**
 * HistoryCard.tsx - 历史记录卡片
 * 
 * 从 HistoryView.tsx 拆分
 * 显示单条批改历史记录
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Eye, EyeOff } from 'lucide-react';

interface BreakdownItem {
    label: string;
    score: number;
    max: number;
    comment?: string;
}

interface HistoryCardProps {
    id: string;
    name?: string;
    questionNo?: string;
    score: number;
    maxScore: number;
    timestamp: number;
    breakdown?: BreakdownItem[];
    isHidden?: boolean;
    style?: React.CSSProperties;
    onDelete?: () => void;
    onToggleHidden?: () => void;
}

/**
 * 获取分数颜色
 */
const getScoreColor = (score: number, maxScore: number): string => {
    if (maxScore === 0) return 'text-gray-500';
    const ratio = score / maxScore;
    if (ratio >= 0.85) return 'text-green-600';
    if (ratio >= 0.6) return 'text-blue-600';
    if (ratio >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
};

/**
 * 获取题目颜色
 */
const getQuestionColor = (questionNo: string): string => {
    const colors = [
        'bg-blue-100 text-blue-700 border-blue-200',
        'bg-green-100 text-green-700 border-green-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-orange-100 text-orange-700 border-orange-200',
        'bg-pink-100 text-pink-700 border-pink-200',
    ];
    const num = parseInt(questionNo) || 0;
    return colors[num % colors.length];
};

/**
 * 格式化时间
 */
const formatTime = (ts: number): string => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return `今天 ${time}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
};

export const HistoryCard: React.FC<HistoryCardProps> = ({
    id,
    name,
    questionNo,
    score,
    maxScore,
    timestamp,
    breakdown = [],
    isHidden = false,
    style,
    onDelete,
    onToggleHidden
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const scoreRate = maxScore > 0 ? (score / maxScore) * 100 : 0;

    return (
        <div
            style={style}
            className={`absolute left-0 right-0 px-3 ${isHidden ? 'opacity-50' : ''}`}
        >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                {/* 主体内容 */}
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        {/* 左侧：题号和姓名 */}
                        <div className="flex items-center gap-2">
                            {questionNo && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getQuestionColor(questionNo)}`}>
                                    {questionNo}题
                                </span>
                            )}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                                {name || '未知学生'}
                            </span>
                        </div>

                        {/* 右侧：分数 */}
                        <div className="flex items-center gap-1">
                            <span className={`text-lg font-bold ${getScoreColor(score, maxScore)}`}>
                                {score}
                            </span>
                            <span className="text-sm text-gray-400">/{maxScore}</span>
                        </div>
                    </div>

                    {/* 进度条 */}
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-600"
                            style={{ width: `${Math.min(scoreRate, 100)}%` }}
                        />
                    </div>

                    {/* 底部：时间和操作 */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>

                        <div className="flex items-center gap-1">
                            {breakdown.length > 0 && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title={isExpanded ? '收起详情' : '展开详情'}
                                >
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                            {onToggleHidden && (
                                <button
                                    onClick={onToggleHidden}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title={isHidden ? '显示记录' : '隐藏记录'}
                                >
                                    {isHidden ? (
                                        <Eye className="w-4 h-4" />
                                    ) : (
                                        <EyeOff className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={onDelete}
                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    title="删除记录"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 展开的详情 */}
                {isExpanded && breakdown.length > 0 && (
                    <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-2 animate-in slide-in-from-top-2 duration-200">
                        {breakdown.map((item, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center justify-between p-2 rounded-lg text-xs ${item.score === item.max
                                        ? 'bg-green-50 dark:bg-green-900/20'
                                        : item.score === 0
                                            ? 'bg-red-50 dark:bg-red-900/20'
                                            : 'bg-gray-50 dark:bg-gray-700/50'
                                    }`}
                            >
                                <span className="text-gray-600 dark:text-gray-300 truncate flex-1">{item.label}</span>
                                <span className={`font-mono font-bold ml-2 ${getScoreColor(item.score, item.max)}`}>
                                    {item.score}/{item.max}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryCard;
