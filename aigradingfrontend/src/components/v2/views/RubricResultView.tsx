import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Download,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    Upload
} from 'lucide-react';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import type { RubricJSONV3 } from '@/types/rubric-v3';
import { getStrategyLabel } from './rubric-config';
import {
    applyEditableItems,
    createEmptyEditableItem,
    getRubricTotalScore,
    toEditableItems,
    type EditableItem,
    type RubricDensity
} from './rubric-view-model';
import {
    validateRubricDraft,
    validateRubricForTemplate,
    type RubricValidationResult
} from './rubric-validator';

interface RubricResultViewProps {
    rubric: RubricJSONV3;
    examName: string;
    subject: string;
    questionNo: string;
    onSave: (rubric: RubricJSONV3) => void;
    onRegenerate: () => void;
    onSaveTemplate?: (rubric: RubricJSONV3) => Promise<void> | void;
    onImport?: (rubric: RubricJSONV3) => void;
    onExport?: (rubric: RubricJSONV3) => void;
    defaultDensity?: RubricDensity;
    onValidate?: (result: RubricValidationResult) => void;
}

function normalizeKeywords(raw: string): string[] {
    const list = raw
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set(list));
}

export default function RubricResultView({
    rubric,
    examName,
    subject,
    questionNo,
    onSave,
    onRegenerate,
    onSaveTemplate,
    onImport,
    onExport,
    onValidate
}: RubricResultViewProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState<RubricJSONV3>(rubric);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

    useEffect(() => {
        setDraft(rubric);
    }, [rubric]);

    const items = useMemo(() => toEditableItems(draft), [draft]);
    const totalScore = useMemo(() => getRubricTotalScore(draft), [draft]);
    const validation = useMemo(() => validateRubricDraft(draft), [draft]);
    const templateValidation = useMemo(() => validateRubricForTemplate(draft), [draft]);
    const hasBlockingErrors = validation.errors.length > 0;
    const hasTemplateBlockingErrors = templateValidation.errors.length > 0;

    useEffect(() => {
        onValidate?.(validation);
    }, [onValidate, validation]);

    const setItems = (updater: (prev: EditableItem[]) => EditableItem[]) => {
        setDraft((prev) => applyEditableItems(prev, updater(toEditableItems(prev))));
    };

    const patchItem = (itemId: string, patch: Partial<EditableItem>) => {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
    };

    const addItem = () => {
        setItems((prev) => [...prev, createEmptyEditableItem(draft.strategyType, draft.metadata.questionId, prev.length)]);
    };

    const deleteItem = (itemId: string) => {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
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
        const currentValidation = validateRubricDraft(draft);
        onValidate?.(currentValidation);
        if (currentValidation.errors.length > 0) {
            window.alert(currentValidation.errors.join('\n'));
            return;
        }

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

    const handleSaveTemplate = async () => {
        if (!onSaveTemplate) return;

        const currentTemplateValidation = validateRubricForTemplate(draft);
        if (currentTemplateValidation.errors.length > 0) {
            window.alert(currentTemplateValidation.errors.join('\n'));
            return;
        }

        try {
            setIsSavingTemplate(true);
            await onSaveTemplate({
                ...draft,
                metadata: {
                    ...draft.metadata,
                    examName: examName || draft.metadata.examName,
                    subject: subject || draft.metadata.subject,
                    questionId: draft.metadata.questionId || questionNo
                }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '模板保存失败，请重试';
            window.alert(message);
        } finally {
            setIsSavingTemplate(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-[#F5F4F1]">
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
            />

            <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F0EFED] bg-white px-4">
                <button
                    onClick={onRegenerate}
                    className="mr-2 flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E5E4E1] bg-[#F5F4F1] text-[#4A4947]"
                    aria-label="返回重修"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[14px] font-black text-[#1A1918]">
                        {subject || draft.metadata.subject || '历史'}评分细则
                    </h1>
                    <p className="text-[9px] font-bold uppercase text-[#9C9B99]">Score Grading Rubric</p>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        aria-label="导入"
                    >
                        <Upload className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        aria-label="导出"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <section className="relative overflow-hidden rounded-2xl border border-[#E5E4E1] bg-white p-4 shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-blue-500">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-[18px] font-black text-[#1A1918]">
                            <span className="rounded bg-[#1A1918] px-2 py-0.5 text-[13px] text-white">
                                #{questionNo || draft.metadata.questionId || '-'}
                            </span>
                            {draft.metadata.title || draft.metadata.questionType || '材料解析题'}
                        </h2>
                        <div className="text-right">
                            <div className="text-[24px] font-black leading-none text-blue-500">{totalScore}</div>
                            <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#9C9B99]">TOTAL SCORE</div>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                        <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[9px] font-bold text-[#4A4947]">
                            策略：{getStrategyLabel(draft.strategyType)}
                        </span>
                    </div>
                </section>

                <section className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[#4A4947]">
                    <h3 className="text-[11px] font-extrabold">
                        评分维度：{draft.metadata.questionType || draft.metadata.title || '建言献策'}
                    </h3>
                </section>

                <section className="space-y-3">
                    {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                            暂无采分点，请先添加条目
                        </div>
                    )}

                    {items.map((item, index) => (
                        <article key={item.id} className="rounded-xl border border-[#E5E4E1] bg-white p-3.5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="rounded bg-[#F5F4F1] px-1.5 py-0.5 text-[10px] font-black text-[#9C9B99]">
                                    {index + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={item.score}
                                        onChange={(event) => patchItem(item.id, { score: event.target.value })}
                                        className="h-6 w-12 rounded border border-[#E5E4E1] bg-[#ECFDF5] px-1 text-center text-[10px] font-extrabold text-[#059669] outline-none focus:border-emerald-300"
                                    />
                                    <span className="rounded bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#059669]">
                                        P
                                    </span>
                                    <button
                                        onClick={() => deleteItem(item.id)}
                                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                        aria-label="删除条目"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <textarea
                                value={item.content}
                                onChange={(event) => patchItem(item.id, { content: event.target.value })}
                                className="mb-2 w-full resize-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 py-2 text-[13px] font-semibold leading-relaxed text-[#1A1918] outline-none focus:border-blue-300"
                                rows={2}
                                placeholder="填写采分点内容"
                            />

                            <input
                                value={item.keywords.join(', ')}
                                onChange={(event) => patchItem(item.id, { keywords: normalizeKeywords(event.target.value) })}
                                className="mb-2 h-8 w-full rounded-lg border border-[#E5E4E1] bg-[#F8F9FA] px-2.5 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                placeholder="关键词，使用逗号分隔"
                            />

                            {item.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {item.keywords.map((keyword) => (
                                        <span
                                            key={`${item.id}-${keyword}`}
                                            className="rounded border border-[#EEF2F6] bg-[#F8F9FA] px-1.5 py-0.5 text-[9px] font-semibold text-[#4A4947]"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </article>
                    ))}
                </section>

                <button
                    onClick={addItem}
                    className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white text-[11px] font-bold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
                >
                    <Plus className="h-3.5 w-3.5" />
                    添加采分点
                </button>
            </div>

            <footer className="border-t border-[#F0EFED] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2">
                    <AlertCircle className={`h-4 w-4 shrink-0 ${hasBlockingErrors ? 'text-red-500' : 'text-amber-500'}`} />
                    <p className={`text-[10px] font-semibold ${hasBlockingErrors ? 'text-red-700' : 'text-[#92400E]'}`}>
                        {hasBlockingErrors
                            ? validation.errors[0]
                            : '请核对手写识别与分值分配合理性'}
                    </p>
                </div>

                <div className="flex gap-2.5">
                    <button
                        onClick={onRegenerate}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E4E1] bg-[#F5F4F1] text-[13px] font-extrabold text-[#4A4947]"
                    >
                        <RefreshCw className="h-4 w-4" />
                        重修
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={hasBlockingErrors}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 text-[13px] font-extrabold text-white shadow-[0_4px_10px_rgba(59,130,246,0.2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                        <Save className="h-4 w-4" />
                        确认保存
                    </button>
                </div>

                <button
                    onClick={handleSaveTemplate}
                    disabled={!onSaveTemplate || hasTemplateBlockingErrors || isSavingTemplate}
                    className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5E4E1] bg-white text-[12px] font-extrabold text-[#4A4947] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSavingTemplate ? '模板保存中...' : '另存为模板'}
                </button>
                {hasTemplateBlockingErrors && (
                    <p className="mt-1.5 text-[10px] font-semibold text-[#B91C1C]">
                        模板保存受限：{templateValidation.errors[0]}
                    </p>
                )}
            </footer>
        </div>
    );
}
