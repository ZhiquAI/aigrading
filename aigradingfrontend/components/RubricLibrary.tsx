/**
 * RubricLibrary.tsx - 评分细则库组件
 * 
 * 在批改页显示已保存的评分细则列表，允许快速切换
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Check, Plus, Upload, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui';
import { storage } from '@/utils/storage';

interface RubricItem {
    key: string;          // 存储 key，如 "app_rubric_content:zhixue:xxx:18"
    questionId: string;   // 题号，如 "18"
    title: string;        // 细则标题
    totalScore: number;   // 总分
    platform: string;     // 平台
}

interface RubricLibraryProps {
    /** 当前选中的题号 key */
    selectedKey: string | null;
    /** 选择细则回调 */
    onSelect: (key: string) => void;
    /** 新建细则回调 */
    onNew: () => void;
    /** 导入细则回调 */
    onImport: () => void;
    /** 编辑当前细则回调 */
    onEdit: () => void;
    /** 是否显示 (控制折叠) */
    defaultExpanded?: boolean;
    /** 自定义类名 */
    className?: string;
}

/**
 * 从存储中解析评分细则的元数据
 */
function parseRubricMeta(rubricText: string): { title: string; totalScore: number } {
    try {
        // 尝试解析 JSON 格式
        const json = JSON.parse(rubricText);
        return {
            title: json.title || '未命名',
            totalScore: json.totalScore || 0
        };
    } catch {
        // 非 JSON，尝试从 Markdown 提取
        const scoreMatch = rubricText.match(/共\s*(\d+)\s*分/);
        const titleMatch = rubricText.match(/###?\s*(?:\(\d+\))?\s*(.+?)(?:（|\(|$)/);
        return {
            title: titleMatch?.[1]?.trim() || '未命名',
            totalScore: scoreMatch ? parseInt(scoreMatch[1]) : 0
        };
    }
}

const RubricLibrary: React.FC<RubricLibraryProps> = ({
    selectedKey,
    onSelect,
    onNew,
    onImport,
    onEdit,
    defaultExpanded = true,
    className = ''
}) => {
    const [rubrics, setRubrics] = useState<RubricItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isLoading, setIsLoading] = useState(true);

    // 加载所有评分细则
    useEffect(() => {
        const loadRubrics = async () => {
            setIsLoading(true);
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                    setIsLoading(false);
                    return;
                }

                chrome.storage.local.get(null, (items: Record<string, unknown>) => {
                    const rubricItems: RubricItem[] = [];

                    for (const key of Object.keys(items)) {
                        if (key.startsWith('app_rubric_content:')) {
                            const value = items[key];
                            if (typeof value === 'string' && value.trim()) {
                                const parts = key.replace('app_rubric_content:', '').split(':');
                                const platform = parts[0] || '未知';
                                const questionId = parts[parts.length - 1] || '?';
                                const meta = parseRubricMeta(value);

                                rubricItems.push({
                                    key: key.replace('app_rubric_content:', ''),
                                    questionId,
                                    title: meta.title,
                                    totalScore: meta.totalScore,
                                    platform
                                });
                            }
                        }
                    }

                    // 按题号排序
                    rubricItems.sort((a, b) =>
                        (parseInt(a.questionId) || 0) - (parseInt(b.questionId) || 0)
                    );

                    setRubrics(rubricItems);
                    setIsLoading(false);
                });
            } catch (e) {
                console.error('[RubricLibrary] Load error:', e);
                setIsLoading(false);
            }
        };

        loadRubrics();

        // 监听存储变化
        const handleStorageChange = () => loadRubrics();
        window.addEventListener('rubric_updated', handleStorageChange);
        return () => window.removeEventListener('rubric_updated', handleStorageChange);
    }, []);

    const hasRubrics = rubrics.length > 0;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
            {/* 标题栏（可折叠） */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        考试汇总管理
                    </span>
                    {hasRubrics && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                            {rubrics.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {selectedKey && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            已选: 第{rubrics.find(r => r.key === selectedKey)?.questionId || '?'}题
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </button>

            {/* 内容区域 */}
            {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                    {isLoading ? (
                        <div className="py-4 text-center text-xs text-gray-400">
                            加载中…
                        </div>
                    ) : hasRubrics ? (
                        <>
                            {/* 细则列表 */}
                            <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                                {rubrics.map((rubric) => {
                                    const isSelected = rubric.key === selectedKey;
                                    return (
                                        <button
                                            key={rubric.key}
                                            onClick={() => onSelect(rubric.key)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
                                                : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                                                }`}
                                        >
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                        {rubric.questionId}题
                                                    </span>
                                                    <span className="text-xs text-gray-400">-</span>
                                                    <span className={`text-xs truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {rubric.title}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`text-xs shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                                                {rubric.totalScore}分
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 操作按钮 */}
                            <div className="mt-3 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onNew}
                                    icon={<Plus className="w-3 h-3" />}
                                    className="flex-1"
                                >
                                    新建
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onImport}
                                    icon={<Upload className="w-3 h-3" />}
                                    className="flex-1"
                                >
                                    导入
                                </Button>
                                {selectedKey && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onEdit}
                                        icon={<Settings className="w-3 h-3" />}
                                        className="flex-1"
                                    >
                                        编辑
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        /* 空状态 */
                        <div className="py-4 text-center">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                还没有保存的评分细则
                            </p>
                            <div className="flex gap-2 justify-center">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={onNew}
                                    icon={<Plus className="w-3 h-3" />}
                                >
                                    新建细则
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onImport}
                                    icon={<Upload className="w-3 h-3" />}
                                >
                                    导入
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RubricLibrary;
