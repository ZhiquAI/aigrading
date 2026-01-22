/**
 * RubricFormEditor.tsx - 评分细则可视化编辑器
 * 
 * 结构化表单编辑评分细则，替代纯文本编辑
 */

import React, { useState, useEffect } from 'react';
import { Plus, Save, FileJson, Eye, Settings2 } from 'lucide-react';
import type { RubricJSON, AnswerPoint, ScoringStrategyType } from '../types/rubric';
import { createEmptyRubric, createEmptyAnswerPoint } from '../types/rubric';
import { rubricToMarkdown } from '../utils/rubric-converter';
import AnswerPointRow from './AnswerPointRow';

interface RubricFormEditorProps {
    /** 初始数据（编辑现有评分细则时传入） */
    initialData?: RubricJSON | null;
    /** 题目 ID（创建新评分细则时使用） */
    questionId?: string;
    /** 保存回调 */
    onSave: (rubric: RubricJSON) => void;
    /** 取消回调 */
    onCancel?: () => void;
}

const RubricFormEditor: React.FC<RubricFormEditorProps> = ({
    initialData,
    questionId = '',
    onSave,
    onCancel,
}) => {
    // 表单状态
    const [rubric, setRubric] = useState<RubricJSON>(() =>
        initialData || createEmptyRubric(questionId)
    );

    // 当前视图：form (表单) | preview (预览)
    const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');

    // 当 initialData 变化时更新表单
    useEffect(() => {
        if (initialData) {
            setRubric(initialData);
        }
    }, [initialData]);

    // 更新字段
    const updateField = <K extends keyof RubricJSON>(field: K, value: RubricJSON[K]) => {
        setRubric(prev => ({
            ...prev,
            [field]: value,
            updatedAt: new Date().toISOString(),
        }));
    };

    // 更新评分策略
    const updateStrategy = <K extends keyof RubricJSON['scoringStrategy']>(
        field: K,
        value: RubricJSON['scoringStrategy'][K]
    ) => {
        setRubric(prev => ({
            ...prev,
            scoringStrategy: { ...prev.scoringStrategy, [field]: value },
            updatedAt: new Date().toISOString(),
        }));
    };

    // 添加得分点
    const addAnswerPoint = () => {
        const newIndex = rubric.answerPoints.length + 1;
        const prefix = rubric.questionId.includes('-')
            ? rubric.questionId.split('-')[1]
            : '1';
        const newPoint = createEmptyAnswerPoint(`${prefix}-${newIndex}`);
        updateField('answerPoints', [...rubric.answerPoints, newPoint]);
    };

    // 更新得分点
    const updateAnswerPoint = (index: number, point: AnswerPoint) => {
        const newPoints = [...rubric.answerPoints];
        newPoints[index] = point;
        updateField('answerPoints', newPoints);
    };

    // 删除得分点
    const deleteAnswerPoint = (index: number) => {
        updateField('answerPoints', rubric.answerPoints.filter((_, i) => i !== index));
    };

    // 添加阅卷提示
    const addGradingNote = () => {
        updateField('gradingNotes', [...rubric.gradingNotes, '']);
    };

    // 更新阅卷提示
    const updateGradingNote = (index: number, value: string) => {
        const newNotes = [...rubric.gradingNotes];
        newNotes[index] = value;
        updateField('gradingNotes', newNotes);
    };

    // 删除阅卷提示
    const deleteGradingNote = (index: number) => {
        updateField('gradingNotes', rubric.gradingNotes.filter((_, i) => i !== index));
    };

    // 计算总分
    const calculatedTotal = rubric.answerPoints.reduce((sum, p) => sum + p.score, 0);

    // 保存
    const handleSave = () => {
        onSave(rubric);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* 基础信息 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileJson size={16} className="text-purple-500" />
                            基础信息
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    题号
                                </label>
                                <input
                                    type="text"
                                    value={rubric.questionId}
                                    onChange={(e) => updateField('questionId', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="如 18-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    题目类型
                                </label>
                                <input
                                    type="text"
                                    value={rubric.title}
                                    onChange={(e) => updateField('title', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="如 影响分析"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    总分
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={rubric.totalScore}
                                        onChange={(e) => updateField('totalScore', parseInt(e.target.value) || 0)}
                                        className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        min={0}
                                    />
                                    <span className="text-xs text-gray-400">
                                        （得分点合计: {calculatedTotal}分）
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    评分策略
                                </label>
                                <select
                                    value={rubric.scoringStrategy.type}
                                    onChange={(e) => updateStrategy('type', e.target.value as ScoringStrategyType)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="pick_n">任选N点得分</option>
                                    <option value="all">全部答对得分</option>
                                    <option value="weighted">加权评分</option>
                                </select>
                            </div>
                        </div>

                        {/* Pick N 策略特有配置 */}
                        {rubric.scoringStrategy.type === 'pick_n' && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        最多取几点
                                    </label>
                                    <input
                                        type="number"
                                        value={rubric.scoringStrategy.maxPoints || 3}
                                        onChange={(e) => updateStrategy('maxPoints', parseInt(e.target.value) || 3)}
                                        className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        min={1}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        每点分值
                                    </label>
                                    <input
                                        type="number"
                                        value={rubric.scoringStrategy.pointValue || 2}
                                        onChange={(e) => updateStrategy('pointValue', parseInt(e.target.value) || 2)}
                                        className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        min={1}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 得分点列表 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-700">
                                得分点 ({rubric.answerPoints.length})
                            </h3>
                            <button
                                onClick={addAnswerPoint}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                                <Plus size={14} />
                                添加得分点
                            </button>
                        </div>

                        <div className="space-y-3">
                            {rubric.answerPoints.map((point, index) => (
                                <AnswerPointRow
                                    key={point.id || index}
                                    point={point}
                                    index={index}
                                    onChange={(updated) => updateAnswerPoint(index, updated)}
                                    onDelete={() => deleteAnswerPoint(index)}
                                />
                            ))}

                            {rubric.answerPoints.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-sm">暂无得分点</p>
                                    <button
                                        onClick={addAnswerPoint}
                                        className="mt-2 text-xs text-purple-600 hover:underline"
                                    >
                                        点击添加第一个得分点
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 阅卷提示 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-700">
                                阅卷提示 ({rubric.gradingNotes.length})
                            </h3>
                            <button
                                onClick={addGradingNote}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                                <Plus size={14} />
                                添加
                            </button>
                        </div>

                        <div className="space-y-2">
                            {rubric.gradingNotes.map((note, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-4">{index + 1}.</span>
                                    <input
                                        type="text"
                                        value={note}
                                        onChange={(e) => updateGradingNote(index, e.target.value)}
                                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="阅卷提示"
                                    />
                                    <button
                                        onClick={() => deleteGradingNote(index)}
                                        className="text-gray-300 hover:text-red-500 p-1"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RubricFormEditor;
