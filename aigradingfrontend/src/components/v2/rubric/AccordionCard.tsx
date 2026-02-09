import React from 'react';
import {
    ChevronDown,
    ChevronUp,
    Sparkles,
    Tag,
    Plus,
    Trash2
} from 'lucide-react';
import { clsx } from 'clsx';

export interface ScorePoint {
    id: string;
    title: string;
    score: number;
    snippet?: string;
    keywords: string[];
    isRequired?: boolean;
}

interface AccordionCardProps {
    point: ScorePoint;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onChange: (updates: Partial<ScorePoint>) => void;
    onDelete: () => void;
    onAddKeyword?: (keyword: string) => void;
    onRemoveKeyword?: (keyword: string) => void;
}

/**
 * AccordionCard - 手风琴折叠卡片
 * 收起状态显示标题+分值，展开显示完整编辑界面
 */
const AccordionCard: React.FC<AccordionCardProps> = ({
    point,
    index,
    isExpanded,
    onToggle,
    onChange,
    onDelete,
    onAddKeyword,
    onRemoveKeyword
}) => {
    return (
        <div
            className={clsx(
                'bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm',
                isExpanded
                    ? 'border-blue-300 shadow-md ring-1 ring-blue-100'
                    : 'border-gray-200'
            )}
        >
            {/* Card Header (Collapsed State) */}
            <div
                onClick={onToggle}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-sm font-bold text-blue-500 bg-blue-50 w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0">
                        {index + 1}
                    </span>
                    <span
                        className={clsx(
                            'font-bold truncate',
                            isExpanded ? 'text-blue-600' : 'text-gray-700'
                        )}
                    >
                        {point.title}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md flex-shrink-0">
                        {point.score}分
                    </span>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Card Body (Expanded State) */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* AI Snippet Evidence */}
                    {point.snippet && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5" />
                                AI 依据 (原文切片)
                            </div>
                            <div className="text-sm text-gray-700 leading-relaxed italic border-l-2 border-amber-200 pl-3 py-1">
                                {point.snippet}
                            </div>
                        </div>
                    )}

                    {/* Keywords Tags */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            核心词 (Keywords)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {point.keywords.map((k) => (
                                <span
                                    key={k}
                                    className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 flex items-center gap-1.5 group cursor-pointer hover:bg-gray-200"
                                    onClick={() => onRemoveKeyword?.(k)}
                                >
                                    {k}
                                    <Plus className="w-3 h-3 rotate-45 text-gray-400 group-hover:text-gray-600" />
                                </span>
                            ))}
                            <button
                                onClick={() => {
                                    const keyword = prompt('输入新关键词:');
                                    if (keyword?.trim()) {
                                        onAddKeyword?.(keyword.trim());
                                    }
                                }}
                                className="px-2.5 py-1 text-blue-500 border border-dashed border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-blue-50 transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                添加
                            </button>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                分值
                            </label>
                            <input
                                type="number"
                                value={point.score}
                                onChange={(e) =>
                                    onChange({ score: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div
                                    onClick={() => onChange({ isRequired: !point.isRequired })}
                                    className={clsx(
                                        'w-5 h-5 rounded border flex items-center justify-center transition-all',
                                        point.isRequired
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'bg-white border-gray-300 group-hover:border-blue-400'
                                    )}
                                >
                                    {point.isRequired && (
                                        <div className="w-2 h-2 bg-white rounded-sm" />
                                    )}
                                </div>
                                <span className="text-sm font-medium text-gray-600">
                                    必须包含
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            删除此点
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccordionCard;
