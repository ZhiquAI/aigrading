import React, { useMemo, useRef, useState } from 'react';
import {
    Check, AlertTriangle, RefreshCw, Plus, Pencil, Trash2, X,
    Download, Upload
} from 'lucide-react';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import type { RubricJSONV3, RubricPoint } from '@/types/rubric-v3';

interface RubricResultViewProps {
    rubric: RubricJSONV3;
    examName: string;
    subject: string;
    questionNo: string;
    onSave: (rubric: RubricJSONV3) => void;
    onRegenerate: () => void;
    onImport?: (rubric: RubricJSONV3) => void;
    onExport?: (rubric: RubricJSONV3) => void;
}

interface EditableItem {
    id: string;
    content: string;
    score: number;
    keywords: string[];
    questionSegment?: string;
}

function toEditableItems(rubric: RubricJSONV3): EditableItem[] {
    if (rubric.strategyType === 'rubric_matrix') {
        return rubric.content.dimensions.map((dim) => ({
            id: dim.id,
            content: dim.name,
            score: dim.weight || Math.max(...dim.levels.map((level) => level.score)),
            keywords: [],
            questionSegment: '评分维度'
        }));
    }

    const points = rubric.strategyType === 'sequential_logic' ? rubric.content.steps : rubric.content.points;
    return points.map((point) => ({
        id: point.id,
        content: point.content,
        score: point.score,
        keywords: point.keywords || [],
        questionSegment: point.questionSegment
    }));
}

function upsertItems(rubric: RubricJSONV3, items: EditableItem[]): RubricJSONV3 {
    const now = new Date().toISOString();
    if (rubric.strategyType === 'rubric_matrix') {
        return {
            ...rubric,
            content: {
                ...rubric.content,
                dimensions: items.map((item) => ({
                    id: item.id,
                    name: item.content,
                    weight: item.score,
                    levels: [
                        {
                            label: 'A',
                            score: item.score,
                            description: item.content
                        }
                    ]
                }))
            },
            updatedAt: now
        };
    }

    const mapped: RubricPoint[] = items.map((item, index) => ({
        id: item.id || `${rubric.metadata.questionId}-${index + 1}`,
        questionSegment: item.questionSegment || '',
        content: item.content,
        keywords: item.keywords,
        score: item.score
    }));

    if (rubric.strategyType === 'sequential_logic') {
        return {
            ...rubric,
            content: {
                ...rubric.content,
                steps: mapped.map((point, index) => ({ ...point, order: index + 1 }))
            },
            updatedAt: now
        };
    }

    return {
        ...rubric,
        content: {
            ...rubric.content,
            points: mapped
        },
        updatedAt: now
    };
}

function calcTotalScore(rubric: RubricJSONV3): number {
    if (rubric.strategyType === 'rubric_matrix') {
        return rubric.content.totalScore
            || rubric.content.dimensions.reduce((sum, dim) => sum + (dim.weight || 0), 0);
    }
    if (rubric.strategyType === 'sequential_logic') {
        return rubric.content.totalScore
            || rubric.content.steps.reduce((sum, step) => sum + (step.score || 0), 0);
    }
    return rubric.content.totalScore
        || rubric.content.points.reduce((sum, point) => sum + (point.score || 0), 0);
}

export default function RubricResultView({
    rubric,
    examName,
    subject,
    questionNo,
    onSave,
    onRegenerate,
    onImport,
    onExport
}: RubricResultViewProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState<RubricJSONV3>(rubric);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newKeyword, setNewKeyword] = useState('');

    const editableItems = useMemo(() => toEditableItems(draft), [draft]);
    const totalScore = useMemo(() => calcTotalScore(draft), [draft]);

    const applyItems = (nextItems: EditableItem[]) => {
        setDraft((prev) => upsertItems(prev, nextItems));
    };

    const updateItem = (itemId: string, patch: Partial<EditableItem>) => {
        applyItems(editableItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
    };

    const deleteItem = (itemId: string) => {
        applyItems(editableItems.filter((item) => item.id !== itemId));
    };

    const addItem = () => {
        const id = `${draft.metadata.questionId || 'Q'}-${editableItems.length + 1}`;
        applyItems([
            ...editableItems,
            { id, content: '', score: 1, keywords: [], questionSegment: '' }
        ]);
        setEditingId(id);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = JSON.parse((e.target?.result as string) || '{}');
                const normalized = coerceRubricToV3(raw).rubric;
                setDraft(normalized);
                onImport?.(normalized);
            } catch {
                window.alert('JSON 格式不正确，请导入 Rubric v3 数据');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleExport = () => {
        const payload = {
            ...draft,
            metadata: {
                ...draft.metadata,
                examName: examName || draft.metadata.examName,
                subject: subject || draft.metadata.subject,
                questionId: draft.metadata.questionId || questionNo
            },
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubric-v3-${questionNo || draft.metadata.questionId || 'export'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onExport?.(draft);
    };

    const handleSave = () => {
        onSave({
            ...draft,
            metadata: {
                ...draft.metadata,
                examName: examName || draft.metadata.examName,
                subject: subject || draft.metadata.subject,
                questionId: draft.metadata.questionId || questionNo
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
            />

            <header className="h-11 flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        #{questionNo || draft.metadata.questionId}
                    </span>
                    <h1 className="font-bold text-slate-800 text-sm truncate max-w-[180px]">
                        {draft.metadata.title || `第${questionNo}题`}
                    </h1>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="导入细则"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="导出细则"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-indigo-600 font-medium">{examName || '未指定考试'}</p>
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                            第{questionNo || draft.metadata.questionId}题 · {subject || draft.metadata.subject || '未设学科'}
                        </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-800">{draft.metadata.title || `第${questionNo}题`}</h2>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-indigo-100/50">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">总分</span>
                            <span className="text-lg font-bold text-indigo-600">{totalScore}</span>
                        </div>
                        <div className="w-px h-4 bg-indigo-200" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">条目</span>
                            <span className="text-lg font-bold text-slate-700">{editableItems.length}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">评分条目</h3>
                        <button
                            onClick={addItem}
                            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            添加条目
                        </button>
                    </div>

                    {editableItems.map((item, index) => (
                        <div
                            key={item.id}
                            className={`bg-white rounded-xl border overflow-hidden transition-colors ${editingId === item.id
                                ? 'border-indigo-300 ring-2 ring-indigo-100'
                                : 'border-slate-200 hover:border-indigo-200'
                                }`}
                        >
                            <div className="p-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    {editingId === item.id ? (
                                        <>
                                            <textarea
                                                value={item.content}
                                                onChange={(e) => updateItem(item.id, { content: e.target.value })}
                                                placeholder="输入条目内容..."
                                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none resize-none focus:border-indigo-300"
                                                rows={2}
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500">分值:</span>
                                                <button
                                                    onClick={() => updateItem(item.id, { score: Math.max(1, item.score - 1) })}
                                                    className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                                                >-</button>
                                                <span className="text-sm font-bold text-slate-800 w-6 text-center">{item.score}</span>
                                                <button
                                                    onClick={() => updateItem(item.id, { score: item.score + 1 })}
                                                    className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                                                >+</button>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.keywords.map((kw) => (
                                                    <span key={`${item.id}-${kw}`} className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] rounded-lg border border-amber-200 flex items-center gap-1">
                                                        {kw}
                                                        <button onClick={() => updateItem(item.id, { keywords: item.keywords.filter((k) => k !== kw) })}>
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    value={newKeyword}
                                                    onChange={(e) => setNewKeyword(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && newKeyword.trim()) {
                                                            updateItem(item.id, { keywords: [...item.keywords, newKeyword.trim()] });
                                                            setNewKeyword('');
                                                        }
                                                    }}
                                                    placeholder="添加关键词"
                                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-indigo-300 outline-none"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (!newKeyword.trim()) return;
                                                        updateItem(item.id, { keywords: [...item.keywords, newKeyword.trim()] });
                                                        setNewKeyword('');
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-medium rounded-lg hover:bg-indigo-600"
                                                >
                                                    添加
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-xs text-slate-700 leading-relaxed">
                                                    {item.questionSegment && (
                                                        <span className="font-medium text-indigo-700">{item.questionSegment}：</span>
                                                    )}
                                                    {item.content}
                                                </p>
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded shrink-0">
                                                    {item.score}分
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {item.keywords.map((kw) => (
                                                    <span
                                                        key={`${item.id}-${kw}`}
                                                        className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] rounded border border-amber-200"
                                                    >
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {editingId === item.id ? (
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="p-1 text-emerald-600 hover:text-emerald-700"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setEditingId(item.id)}
                                            className="p-1 text-slate-400 hover:text-slate-600"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteItem(item.id)}
                                        className="p-1 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">请检查内容、分值和关键词后再保存</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onRegenerate}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重新生成
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        确认并保存
                    </button>
                </div>
            </div>
        </div>
    );
}
