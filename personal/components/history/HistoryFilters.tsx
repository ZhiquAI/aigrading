/**
 * HistoryFilters.tsx - 历史记录筛选器
 * 
 * 从 HistoryView.tsx 拆分
 * 提供题目筛选、隐藏记录切换等功能
 */

import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown, Download, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface QuestionGroup {
    key: string;
    label: string;
    count: number;
    repeats?: number;
}

interface HistoryFiltersProps {
    questions: QuestionGroup[];
    selectedQuestion: string | null;
    showHidden: boolean;
    totalCount: number;
    hiddenCount: number;
    onSelectQuestion: (key: string | null) => void;
    onToggleHidden: () => void;
    onExport?: () => void;
    onCleanRepeats?: () => void;
    onDeleteQuestion?: () => void;
    onRefresh?: () => void;
}

export const HistoryFilters: React.FC<HistoryFiltersProps> = ({
    questions,
    selectedQuestion,
    showHidden,
    totalCount,
    hiddenCount,
    onSelectQuestion,
    onToggleHidden,
    onExport,
    onCleanRepeats,
    onDeleteQuestion,
    onRefresh
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = selectedQuestion
        ? questions.find(q => q.key === selectedQuestion)?.label || '未知题目'
        : '全部题目';

    const selectedRepeats = selectedQuestion
        ? questions.find(q => q.key === selectedQuestion)?.repeats || 0
        : 0;

    return (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 space-y-3">
            {/* 第一行：题目选择和操作按钮 */}
            <div className="flex items-center gap-2">
                {/* 题目下拉选择 */}
                <div className="relative flex-1" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                        <span className="font-medium text-gray-700 dark:text-gray-200">{selectedLabel}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 下拉菜单 */}
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                            <button
                                onClick={() => {
                                    onSelectQuestion(null);
                                    setIsDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center ${!selectedQuestion ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-700 dark:text-gray-200'
                                    }`}
                            >
                                <span>全部题目</span>
                                <span className="text-xs text-gray-400">{totalCount}</span>
                            </button>

                            {questions.map(q => (
                                <button
                                    key={q.key}
                                    onClick={() => {
                                        onSelectQuestion(q.key);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center ${selectedQuestion === q.key ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-700 dark:text-gray-200'
                                        }`}
                                >
                                    <span>{q.label}</span>
                                    <div className="flex items-center gap-2">
                                        {q.repeats && q.repeats > 0 && (
                                            <span className="text-xs text-orange-500">{q.repeats}重复</span>
                                        )}
                                        <span className="text-xs text-gray-400">{q.count}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 操作按钮组 */}
                <div className="flex items-center gap-1">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="刷新"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    {onExport && selectedQuestion && (
                        <button
                            onClick={onExport}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            title="导出 CSV"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* 第二行：显示隐藏切换和批量操作 */}
            <div className="flex items-center justify-between">
                {/* 左侧：显示隐藏记录 */}
                <button
                    onClick={onToggleHidden}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${showHidden
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {showHidden ? '已显示隐藏' : `隐藏 ${hiddenCount}`}
                </button>

                {/* 右侧：批量操作 */}
                {selectedQuestion && (
                    <div className="flex items-center gap-2">
                        {selectedRepeats > 0 && onCleanRepeats && (
                            <button
                                onClick={onCleanRepeats}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" />
                                清理重复 ({selectedRepeats})
                            </button>
                        )}
                        {onDeleteQuestion && (
                            <button
                                onClick={onDeleteQuestion}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                删除全部
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryFilters;
