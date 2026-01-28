/**
 * AnswerPointRow.tsx - 单个得分点编辑行
 * 
 * 可视化编辑单个得分点，支持展开/折叠详细配置
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, GripVertical, Plus, X } from 'lucide-react';
import type { AnswerPoint } from '@/types/rubric';

interface AnswerPointRowProps {
    point: AnswerPoint;
    index: number;
    onChange: (point: AnswerPoint) => void;
    onDelete: () => void;
}

const AnswerPointRow: React.FC<AnswerPointRowProps> = ({
    point,
    index,
    onChange,
    onDelete,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // 更新字段
    const updateField = <K extends keyof AnswerPoint>(field: K, value: AnswerPoint[K]) => {
        onChange({ ...point, [field]: value });
    };

    // 添加关键词
    const addKeyword = () => {
        updateField('keywords', [...point.keywords, '']);
    };

    // 更新关键词
    const updateKeyword = (keywordIndex: number, value: string) => {
        const newKeywords = [...point.keywords];
        newKeywords[keywordIndex] = value;
        updateField('keywords', newKeywords);
    };

    // 删除关键词
    const removeKeyword = (keywordIndex: number) => {
        updateField('keywords', point.keywords.filter((_, i) => i !== keywordIndex));
    };

    return (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            {/* 主行：拖动手柄 + 编号 + 内容 + 分值 + 展开/删除 */}
            <div className="flex items-center gap-2 p-3">
                {/* 拖动手柄 */}
                <div className="cursor-grab text-gray-300 hover:text-gray-500">
                    <GripVertical size={16} />
                </div>

                {/* 编号 */}
                <input
                    type="text"
                    value={point.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    className="w-14 px-2 py-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="1-1"
                />

                {/* 问题词 */}
                <input
                    type="text"
                    value={point.questionSegment || ''}
                    onChange={(e) => updateField('questionSegment', e.target.value)}
                    className="w-24 px-2 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="问题词"
                />

                {/* 答案内容 */}
                <input
                    type="text"
                    value={point.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="标准答案内容"
                />

                {/* 分值 */}
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        value={point.score}
                        onChange={(e) => updateField('score', parseInt(e.target.value) || 0)}
                        className="w-12 px-2 py-1.5 text-xs text-center bg-purple-50 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        min={0}
                        max={10}
                    />
                    <span className="text-xs text-gray-500">分</span>
                </div>

                {/* 展开/折叠按钮 */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title={isExpanded ? '收起' : '展开详细配置'}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* 删除按钮 */}
                <button
                    onClick={onDelete}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除此得分点"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* 展开区域：关键词、必选关键词、扣分规则 */}
            {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-3">
                    {/* 关键词 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-600">
                                关键词
                                <span className="text-gray-400 font-normal ml-1">（用于自动匹配，支持 A+B 表示需同时包含）</span>
                            </label>
                            <button
                                onClick={addKeyword}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                            >
                                <Plus size={12} />
                                添加
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {point.keywords.map((keyword, keywordIndex) => (
                                <div key={keywordIndex} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                                    <input
                                        type="text"
                                        value={keyword}
                                        onChange={(e) => updateKeyword(keywordIndex, e.target.value)}
                                        className="w-24 text-xs border-none focus:ring-0 p-0"
                                        placeholder="关键词"
                                    />
                                    <button
                                        onClick={() => removeKeyword(keywordIndex)}
                                        className="text-gray-300 hover:text-red-500"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            {point.keywords.length === 0 && (
                                <span className="text-xs text-gray-400">暂无关键词，点击"添加"按钮添加</span>
                            )}
                        </div>
                    </div>

                    {/* 必选关键词 */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-2">
                            必选关键词
                            <span className="text-gray-400 font-normal ml-1">（缺少则扣分，逗号分隔）</span>
                        </label>
                        <input
                            type="text"
                            value={point.requiredKeywords?.join(', ') || ''}
                            onChange={(e) => {
                                const keywords = e.target.value
                                    .split(/[,，]/)
                                    .map(k => k.trim())
                                    .filter(k => k.length > 0);
                                updateField('requiredKeywords', keywords.length > 0 ? keywords : undefined);
                            }}
                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="例如：国力, 提升"
                        />
                    </div>

                    {/* 扣分规则 */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-2">
                            扣分规则
                            <span className="text-gray-400 font-normal ml-1">（可选）</span>
                        </label>
                        <input
                            type="text"
                            value={point.deductionRules || ''}
                            onChange={(e) => updateField('deductionRules', e.target.value || undefined)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="例如：判定模式：维度匹配（τ=0.85）。命中2维度=2分，1维度=1分"
                        />
                    </div>

                    {/* 开放题标记 */}
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={point.openEnded || false}
                                onChange={(e) => updateField('openEnded', e.target.checked || undefined)}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-600">
                                开放题
                                <span className="text-gray-400 font-normal ml-1">（此得分点言之有理即得满分）</span>
                            </span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnswerPointRow;
