/**
 * QuickEditDemo - 内联编辑原型验证组件
 * 
 * 使用 react-easy-edit 验证在 Side Panel 紧凑空间下的内联编辑体验
 * 模拟阅卷结果中快速调整评分细则的场景
 */
import React, { useState } from 'react';
import EasyEdit, { Types } from 'react-easy-edit';
import { Check, X, Pencil, Plus, Trash2 } from 'lucide-react';

interface AnswerPoint {
    id: string;
    content: string;
    keywords: string[];
    score: number;
    maxScore: number;
}

interface QuickEditDemoProps {
    onClose?: () => void;
}

export default function QuickEditDemo({ onClose }: QuickEditDemoProps) {
    // 模拟评分细则数据
    const [answerPoints, setAnswerPoints] = useState<AnswerPoint[]>([
        {
            id: '1',
            content: '经济动因分析',
            keywords: ['资本主义萌芽', '商品经济'],
            score: 4,
            maxScore: 4
        },
        {
            id: '2',
            content: '社会阶层变动',
            keywords: ['资产阶级兴起'],
            score: 2,
            maxScore: 4
        },
        {
            id: '3',
            content: '卷面表达规范',
            keywords: ['书写工整', '条理清晰'],
            score: 2,
            maxScore: 2
        }
    ]);

    // 更新得分点内容
    const handleSaveContent = (id: string, value: string) => {
        setAnswerPoints(prev =>
            prev.map(p => p.id === id ? { ...p, content: value } : p)
        );
    };

    // 更新分值
    const handleSaveScore = (id: string, value: string) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setAnswerPoints(prev =>
                prev.map(p => p.id === id ? { ...p, maxScore: numValue } : p)
            );
        }
    };

    // 添加关键词
    const handleAddKeyword = (id: string, keyword: string) => {
        if (!keyword.trim()) return;
        setAnswerPoints(prev =>
            prev.map(p => p.id === id
                ? { ...p, keywords: [...p.keywords, keyword.trim()] }
                : p
            )
        );
    };

    // 删除关键词
    const handleRemoveKeyword = (id: string, keywordIndex: number) => {
        setAnswerPoints(prev =>
            prev.map(p => p.id === id
                ? { ...p, keywords: p.keywords.filter((_, i) => i !== keywordIndex) }
                : p
            )
        );
    };

    // 自定义保存/取消按钮
    const saveButton = <Check className="w-4 h-4 text-emerald-600" />;
    const cancelButton = <X className="w-4 h-4 text-slate-400" />;

    return (
        <div className="p-4 bg-white rounded-2xl shadow-lg border border-slate-100 max-w-[360px]">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-indigo-500" />
                    快捷细则调整 (原型)
                </h3>
                {onClose && (
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* 得分点列表 */}
            <div className="space-y-3">
                {answerPoints.map((point) => (
                    <div
                        key={point.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
                    >
                        {/* 得分点标题 - 可编辑 */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                                <EasyEdit
                                    type={Types.TEXT}
                                    value={point.content}
                                    onSave={(value: string) => handleSaveContent(point.id, value)}
                                    saveButtonLabel={saveButton}
                                    cancelButtonLabel={cancelButton}
                                    attributes={{
                                        className: "w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    }}
                                    viewAttributes={{
                                        className: "text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
                                    }}
                                    placeholder="点击编辑..."
                                />
                            </div>

                            {/* 分值 - 可编辑 */}
                            <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${point.score === point.maxScore
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {point.score}/
                                    <EasyEdit
                                        type={Types.TEXT}
                                        value={String(point.maxScore)}
                                        onSave={(value: string) => handleSaveScore(point.id, value)}
                                        saveButtonLabel={saveButton}
                                        cancelButtonLabel={cancelButton}
                                        attributes={{
                                            className: "w-8 px-1 py-0 text-[10px] text-center border border-indigo-300 rounded focus:outline-none",
                                            type: "number",
                                            min: "0",
                                            step: "1"
                                        }}
                                        viewAttributes={{
                                            className: "cursor-pointer hover:underline"
                                        }}
                                    />
                                </span>
                            </div>
                        </div>

                        {/* 关键词列表 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {point.keywords.map((keyword, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] text-slate-600 group"
                                >
                                    {keyword}
                                    <button
                                        onClick={() => handleRemoveKeyword(point.id, idx)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-2.5 h-2.5 text-slate-400 hover:text-red-500" />
                                    </button>
                                </span>
                            ))}

                            {/* 添加关键词 */}
                            <div className="inline-flex items-center">
                                <EasyEdit
                                    type={Types.TEXT}
                                    value=""
                                    onSave={(value: string) => {
                                        handleAddKeyword(point.id, value);
                                    }}
                                    saveButtonLabel={saveButton}
                                    cancelButtonLabel={cancelButton}
                                    attributes={{
                                        className: "w-20 px-2 py-0.5 text-[10px] border border-indigo-300 rounded-full focus:outline-none",
                                        placeholder: "新关键词..."
                                    }}
                                    viewAttributes={{
                                        className: "cursor-pointer"
                                    }}
                                    placeholder={
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-50 border border-dashed border-indigo-200 rounded-full text-[10px] text-indigo-500 hover:bg-indigo-100 transition-colors">
                                            <Plus className="w-2.5 h-2.5" />
                                            添加
                                        </span>
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                    💡 点击文字即可编辑
                </span>
                <button className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                    保存修改
                </button>
            </div>
        </div>
    );
}
