import React, { useState, useRef } from 'react';
import {
    Check, AlertTriangle, RefreshCw, Plus, Pencil, Trash2, X,
    ChevronDown, ChevronUp, Download
} from 'lucide-react';

interface AnswerPoint {
    id: string;
    questionSegment?: string;
    content: string;
    keywords: string[];
    requiredKeywords?: string[];
    score: number;
}

interface GeneratedRubric {
    questionId: string;
    title: string;
    totalScore: number;
    answerPoints: AnswerPoint[];
    examName?: string;
    subject?: string;
    questionNo?: string;
}

interface RubricResultViewProps {
    rubric: GeneratedRubric;
    examName: string;
    subject: string;
    questionNo: string;
    onSave: (rubric: GeneratedRubric) => void;
    onRegenerate: () => void;
    onImport?: (rubric: GeneratedRubric) => void;
    onExport?: (rubric: GeneratedRubric) => void;
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
    const [editingRubric, setEditingRubric] = useState<GeneratedRubric>(rubric);
    const [editingPointId, setEditingPointId] = useState<string | null>(null);
    const [expandedPointId, setExpandedPointId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 导入 JSON 文件
    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                // 验证必要字段
                if (json.answerPoints && Array.isArray(json.answerPoints)) {
                    const imported: GeneratedRubric = {
                        questionId: json.questionId || `q-${Date.now()}`,
                        title: json.title || '',
                        totalScore: json.totalScore || json.answerPoints.reduce((sum: number, p: AnswerPoint) => sum + (p.score || 0), 0),
                        answerPoints: json.answerPoints.map((p: Partial<AnswerPoint>, idx: number) => ({
                            id: p.id || `point-${Date.now()}-${idx}`,
                            content: p.content || '',
                            keywords: p.keywords || [],
                            score: p.score || 0,
                            questionSegment: p.questionSegment
                        })),
                        examName: json.examName || examName,
                        subject: json.subject || subject,
                        questionNo: json.questionNo || questionNo
                    };
                    setEditingRubric(imported);
                    onImport?.(imported);
                } else {
                    alert('JSON 格式不正确，请确保包含 answerPoints 数组');
                }
            } catch {
                alert('无法解析 JSON 文件');
            }
        };
        reader.readAsText(file);
        // 重置 input 以支持重复导入同一文件
        event.target.value = '';
    };

    // 导出为 JSON 文件
    const handleExport = () => {
        const exportData = {
            ...editingRubric,
            examName,
            subject,
            questionNo,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubric-${questionNo || 'export'}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onExport?.(editingRubric);
    };

    // 计算总分
    const totalScore = editingRubric.answerPoints.reduce((sum, p) => sum + p.score, 0);

    // 更新得分点
    const updatePoint = (pointId: string, updates: Partial<AnswerPoint>) => {
        setEditingRubric(prev => ({
            ...prev,
            answerPoints: prev.answerPoints.map(p =>
                p.id === pointId ? { ...p, ...updates } : p
            )
        }));
    };

    // 删除得分点
    const deletePoint = (pointId: string) => {
        setEditingRubric(prev => ({
            ...prev,
            answerPoints: prev.answerPoints.filter(p => p.id !== pointId)
        }));
    };

    // 添加得分点
    const addPoint = () => {
        const newPoint: AnswerPoint = {
            id: `point-${Date.now()}`,
            content: '',
            keywords: [],
            score: 1
        };
        setEditingRubric(prev => ({
            ...prev,
            answerPoints: [...prev.answerPoints, newPoint]
        }));
        setEditingPointId(newPoint.id);
    };

    // 添加关键词
    const addKeyword = (pointId: string, keyword: string) => {
        if (!keyword.trim()) return;
        updatePoint(pointId, {
            keywords: [...(editingRubric.answerPoints.find(p => p.id === pointId)?.keywords || []), keyword.trim()]
        });
    };

    // 删除关键词
    const removeKeyword = (pointId: string, keyword: string) => {
        const point = editingRubric.answerPoints.find(p => p.id === pointId);
        if (point) {
            updatePoint(pointId, {
                keywords: point.keywords.filter(k => k !== keyword)
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* 隐藏的文件输入 */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
            />

            {/* Header - 简洁显示题目信息 */}
            <header className="h-11 flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        #{questionNo}
                    </span>
                    <h1 className="font-bold text-slate-800 text-sm truncate max-w-[180px]">
                        {editingRubric.title || `第${questionNo}题`}
                    </h1>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleExport}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="导出此细则"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* 结果内容区 */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {/* 概览卡片 - 清晰展示题号/题目/学科/总分 */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100">
                    {/* 第一行：考试名称 + 题号/学科标签 */}
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-indigo-600 font-medium">{examName || '未指定考试'}</p>
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                            第{questionNo}题 · {subject}
                        </span>
                    </div>
                    {/* 第二行：题目标题 */}
                    <h2 className="text-base font-bold text-slate-800">
                        {editingRubric.title || `第${questionNo}题`}
                    </h2>
                    {/* 第三行：统计信息 */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-indigo-100/50">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">总分</span>
                            <span className="text-lg font-bold text-indigo-600">{totalScore}</span>
                            <span className="text-[10px] text-slate-400">分</span>
                        </div>
                        <div className="w-px h-4 bg-indigo-200" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">得分点</span>
                            <span className="text-lg font-bold text-slate-700">{editingRubric.answerPoints.length}</span>
                            <span className="text-[10px] text-slate-400">个</span>
                        </div>
                    </div>
                </div>

                {/* 得分点列表 */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">得分点列表</h3>
                        <button
                            onClick={addPoint}
                            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            添加得分点
                        </button>
                    </div>

                    {editingRubric.answerPoints.map((point, index) => (
                        <div
                            key={point.id}
                            className={`bg-white rounded-xl border overflow-hidden transition-colors ${editingPointId === point.id
                                ? 'border-indigo-300 ring-2 ring-indigo-100'
                                : 'border-slate-200 hover:border-indigo-200'
                                }`}
                        >
                            <div className="p-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingPointId === point.id ? (
                                        /* 编辑模式 */
                                        <div className="space-y-2">
                                            <textarea
                                                value={point.content}
                                                onChange={e => updatePoint(point.id, { content: e.target.value })}
                                                placeholder="输入得分点内容..."
                                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none resize-none focus:border-indigo-300"
                                                rows={2}
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500">分值:</span>
                                                <button
                                                    onClick={() => updatePoint(point.id, { score: Math.max(1, point.score - 1) })}
                                                    className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                                                >−</button>
                                                <span className="text-sm font-bold text-slate-800 w-6 text-center">{point.score}</span>
                                                <button
                                                    onClick={() => updatePoint(point.id, { score: point.score + 1 })}
                                                    className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                                                >+</button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPointId(null)}
                                                    className="px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-medium rounded-lg hover:bg-indigo-600"
                                                >
                                                    完成
                                                </button>
                                                <button
                                                    onClick={() => deletePoint(point.id)}
                                                    className="px-3 py-1.5 text-red-500 text-[10px] font-medium hover:underline"
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* 预览模式 */
                                        <>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-xs text-slate-700 leading-relaxed">
                                                    {point.questionSegment && (
                                                        <span className="font-medium text-indigo-700">{point.questionSegment}：</span>
                                                    )}
                                                    {point.content}
                                                </p>
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded shrink-0">
                                                    {point.score}分
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {point.keywords.map((kw, ki) => (
                                                    <span
                                                        key={ki}
                                                        className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] rounded border border-amber-200"
                                                    >
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {editingPointId !== point.id && (
                                    <button
                                        onClick={() => setEditingPointId(point.id)}
                                        className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* 展开关键词编辑 */}
                            {expandedPointId === point.id && editingPointId !== point.id && (
                                <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                                    <PointKeywordEditor
                                        point={point}
                                        onAddKeyword={(kw) => addKeyword(point.id, kw)}
                                        onRemoveKeyword={(kw) => removeKeyword(point.id, kw)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 底部操作栏 */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
                {/* 操作提示 */}
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">请检查得分点和关键词是否正确，确认后保存</p>
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
                        onClick={() => onSave(editingRubric)}
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

// 关键词编辑子组件
function PointKeywordEditor({
    point,
    onAddKeyword,
    onRemoveKeyword
}: {
    point: AnswerPoint;
    onAddKeyword: (kw: string) => void;
    onRemoveKeyword: (kw: string) => void;
}) {
    const [newKeyword, setNewKeyword] = useState('');

    const handleAdd = () => {
        if (newKeyword.trim()) {
            onAddKeyword(newKeyword.trim());
            setNewKeyword('');
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {point.keywords.map((kw, i) => (
                    <span
                        key={i}
                        className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] rounded-lg border border-amber-200 flex items-center gap-1"
                    >
                        {kw}
                        <button
                            onClick={() => onRemoveKeyword(kw)}
                            className="hover:text-amber-900"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="输入新关键词..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-indigo-300 outline-none"
                />
                <button
                    onClick={handleAdd}
                    className="px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-medium rounded-lg hover:bg-indigo-600"
                >
                    添加
                </button>
            </div>
        </div>
    );
}
