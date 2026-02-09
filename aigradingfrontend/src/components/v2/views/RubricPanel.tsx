import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    Camera,
    ChevronDown,
    ChevronLeft,
    FileCheck2,
    Image as ImageIcon,
    Info,
    Library,
    Sparkles,
    Upload,
    X,
    Zap
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages } from '@/services/rubric-service';
import { createRubricTemplate } from '@/services/rubric-templates';
import { toast } from '@/components/Toast';
import type { RubricJSONV3, StrategyType } from '@/types/rubric-v3';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import RubricResultView from './RubricResultView';
import RubricListView from './RubricListView';
import type { RubricTemplateSeed } from './RubricListView';
import {
    RUBRIC_STRATEGY_OPTIONS,
    getQuestionTypeOptions,
    getSubjectOptions,
    inferStrategyTypeByQuestionType
} from './rubric-config';
import { validateRubricForTemplate } from './rubric-validator';
import { setRubricTemplateLifecycleStatus } from './rubric-template-status';

type ViewState = 'welcome' | 'list' | 'input' | 'generating' | 'result';

const GENERATING_MESSAGES = [
    '正在识别题干结构...',
    '正在提取采分点与关键词...',
    '正在匹配评分策略与题型...',
    '正在生成可编辑评分细则...'
];

const SUBJECT_OPTIONS = getSubjectOptions();
const GRADE_OPTIONS = ['初一', '初二', '初三', '高一', '高二', '高三'];

export default function RubricPanel() {
    const {
        exams,
        rubricLibrary,
        rubricData,
        activeExamId,
        setActiveExamId,
        setRubricConfig,
        saveRubric,
        createExamAction,
        loadConfiguredQuestions
    } = useAppStore();

    const defaultSubject = SUBJECT_OPTIONS[0]?.value || '历史';
    const defaultQuestionType = getQuestionTypeOptions(defaultSubject)[0]?.value || '材料题';

    const [viewState, setViewState] = useState<ViewState>('welcome');
    const [inputBackTarget, setInputBackTarget] = useState<'welcome' | 'list'>('welcome');
    const [generatedRubric, setGeneratedRubric] = useState<RubricJSONV3 | null>(null);
    const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const [showNewExamInput, setShowNewExamInput] = useState(false);
    const [newExamName, setNewExamName] = useState('');
    const [questionNo, setQuestionNo] = useState('');
    const [subject, setSubject] = useState(defaultSubject);
    const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
    const [questionType, setQuestionType] = useState(defaultQuestionType);
    const [strategyType, setStrategyType] = useState<StrategyType>(
        inferStrategyTypeByQuestionType(defaultSubject, defaultQuestionType)
    );

    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);

    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationStep, setGenerationStep] = useState(0);

    const selectedExam = useMemo(
        () => exams.find((e) => e.id === activeExamId),
        [exams, activeExamId]
    );

    const questionTypeOptions = useMemo(
        () => getQuestionTypeOptions(subject),
        [subject]
    );

    const generatingProgress = ((generationStep + 1) / GENERATING_MESSAGES.length) * 100;

    useEffect(() => {
        if (viewState !== 'generating') {
            setGenerationStep(0);
            return;
        }
        const timer = setInterval(() => {
            setGenerationStep((prev) => (prev + 1) % GENERATING_MESSAGES.length);
        }, 1400);
        return () => clearInterval(timer);
    }, [viewState]);

    const resetInputState = useCallback(() => {
        setQuestionNo('');
        setGrade(GRADE_OPTIONS[2]);
        setQuestionImage(null);
        setAnswerImage(null);
        setGenerationError(null);

        const nextType = getQuestionTypeOptions(subject)[0]?.value || defaultQuestionType;
        setQuestionType(nextType);
        setStrategyType(inferStrategyTypeByQuestionType(subject, nextType));
    }, [defaultQuestionType, subject]);

    const findExistingQuestionKey = useCallback((rubric: RubricJSONV3): string | null => {
        const targetQuestionId = (rubric.metadata.questionId || '').trim();
        const targetSubject = (rubric.metadata.subject || '').trim();
        const targetExam = rubric.metadata.examId || null;

        if (!targetQuestionId) return null;

        for (const item of rubricLibrary || []) {
            const existing = rubricData?.[item.id];
            if (!existing) continue;

            try {
                const normalized = coerceRubricToV3(existing).rubric;
                const matchesQuestion = (normalized.metadata.questionId || '').trim() === targetQuestionId;
                const matchesSubject = !targetSubject || (normalized.metadata.subject || '').trim() === targetSubject;
                const matchesExam = (normalized.metadata.examId || null) === targetExam;

                if (matchesQuestion && matchesSubject && matchesExam) {
                    return item.id;
                }
            } catch {
                continue;
            }
        }

        return null;
    }, [rubricData, rubricLibrary]);

    const buildManualQuestionKey = useCallback((rubric: RubricJSONV3): string => {
        const safeQuestionNo = (rubric.metadata.questionId || questionNo || 'unknown').trim() || 'unknown';
        const safeSubject = (rubric.metadata.subject || subject || 'unknown').trim() || 'unknown';
        const safeExam = (rubric.metadata.examId || activeExamId || 'noexam').trim() || 'noexam';

        return `manual:${safeExam}:${safeSubject}:${safeQuestionNo}`;
    }, [activeExamId, questionNo, subject]);

    const openInput = useCallback((backTarget: 'welcome' | 'list') => {
        setSelectedQuestionKey(null);
        setGeneratedRubric(null);
        setInputBackTarget(backTarget);
        setViewState('input');
        resetInputState();
    }, [resetInputState]);

    const handleCreateNew = useCallback(() => {
        openInput('list');
    }, [openInput]);

    const handleCreateFromGuide = useCallback(() => {
        openInput('welcome');
    }, [openInput]);

    const handleOpenTemplateList = useCallback(() => {
        setViewState('list');
    }, []);

    const handleImportRubricFromGuide = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = JSON.parse((e.target?.result as string) || '{}');
                const normalized = coerceRubricToV3(raw).rubric;
                setGeneratedRubric(normalized);
                setSelectedQuestionKey(null);
                setQuestionNo(normalized.metadata.questionId || '');
                setSubject(normalized.metadata.subject || defaultSubject);
                setGrade(normalized.metadata.grade || GRADE_OPTIONS[2]);
                const nextType = normalized.metadata.questionType
                    || getQuestionTypeOptions(normalized.metadata.subject || defaultSubject)[0]?.value
                    || defaultQuestionType;
                setQuestionType(nextType);
                setStrategyType(
                    normalized.strategyType
                    || inferStrategyTypeByQuestionType(normalized.metadata.subject || defaultSubject, nextType)
                );
                setActiveExamId(normalized.metadata.examId || null);
                setInputBackTarget('welcome');
                setViewState('result');
                toast.success('已导入评分细则，可继续编辑后保存');
            } catch (error) {
                console.error('[RubricPanel] Import rubric error:', error);
                toast.error('导入失败：仅支持 Rubric v3 JSON');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [defaultQuestionType, defaultSubject, setActiveExamId]);

    const handleUseTemplate = useCallback((template: RubricTemplateSeed) => {
        setSelectedQuestionKey(null);
        setGeneratedRubric(null);
        setGenerationError(null);
        setQuestionNo('');
        setQuestionImage(null);
        setAnswerImage(null);
        setShowNewExamInput(false);
        setNewExamName('');
        setSubject(template.subject);
        setQuestionType(template.questionType);
        setStrategyType(template.strategyType);
        if (template.examId) {
            setActiveExamId(template.examId);
        }
        setInputBackTarget('list');
        setViewState('input');
        toast.success(`已应用模板：${template.subject} · ${template.questionType}`);
    }, [setActiveExamId]);

    const handleSelectRubric = useCallback((questionKey: string) => {
        const target = rubricData?.[questionKey];
        if (!target) {
            toast.error('未找到对应评分细则');
            return;
        }

        try {
            const normalized = coerceRubricToV3(target).rubric;
            setGeneratedRubric(normalized);
            setSelectedQuestionKey(questionKey);
            setQuestionNo(normalized.metadata.questionId || '');
            setSubject(normalized.metadata.subject || defaultSubject);
            setGrade(normalized.metadata.grade || GRADE_OPTIONS[2]);
            const nextType = normalized.metadata.questionType || getQuestionTypeOptions(normalized.metadata.subject || defaultSubject)[0]?.value || defaultQuestionType;
            setQuestionType(nextType);
            setStrategyType(normalized.strategyType || inferStrategyTypeByQuestionType(normalized.metadata.subject || defaultSubject, nextType));
            setActiveExamId(normalized.metadata.examId || null);
            setGenerationError(null);
            setViewState('result');
        } catch (error) {
            console.error('[RubricPanel] Select rubric error:', error);
            toast.error('细则数据格式异常，无法打开');
        }
    }, [defaultQuestionType, defaultSubject, rubricData, setActiveExamId]);

    const handleBackToList = useCallback(() => {
        setViewState(inputBackTarget);
    }, [inputBackTarget]);

    const handleCreateExam = useCallback(async () => {
        if (!newExamName.trim()) return;
        try {
            const newExam = await createExamAction({
                name: newExamName.trim(),
                grade,
                subject,
                date: new Date().toISOString().split('T')[0]
            });
            setNewExamName('');
            setShowNewExamInput(false);
            if (newExam?.id) {
                setActiveExamId(newExam.id);
            }
            toast.success('考试已创建');
        } catch (error) {
            console.error('[RubricPanel] Create exam error:', error);
            toast.error('创建失败');
        }
    }, [createExamAction, grade, newExamName, setActiveExamId, subject]);

    const handleImageUpload = useCallback((type: 'question' | 'answer') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (!ev.target?.result) return;

            if (type === 'question') {
                setQuestionImage(ev.target.result as string);
            } else {
                setAnswerImage(ev.target.result as string);
            }
            setGenerationError(null);
            toast.success('图片已上传');
        };
        reader.readAsDataURL(file);
    }, []);

    const handleGenerate = useCallback(async () => {
        if (!questionNo.trim()) {
            toast.error('请输入题号');
            return;
        }

        if (!answerImage) {
            toast.error('请上传答案照片');
            return;
        }

        setGenerationError(null);
        setViewState('generating');

        try {
            const context = {
                subject,
                grade,
                questionType,
                strategyType,
                examName: selectedExam?.name || undefined
            };

            const rubric = await generateRubricFromImages(questionImage, answerImage, questionNo.trim(), context);

            const normalizedRubric: RubricJSONV3 = {
                ...rubric,
                metadata: {
                    ...rubric.metadata,
                    examName: selectedExam?.name || rubric.metadata.examName || '',
                    examId: activeExamId || rubric.metadata.examId || null,
                    subject: subject || rubric.metadata.subject,
                    grade: grade || rubric.metadata.grade,
                    questionType: questionType || rubric.metadata.questionType,
                    questionId: questionNo.trim() || rubric.metadata.questionId
                },
                strategyType: rubric.strategyType || strategyType
            };

            setGeneratedRubric(normalizedRubric);
            setViewState('result');
        } catch (error) {
            console.error('[RubricPanel] AI generation failed:', error);
            const message = error instanceof Error ? error.message : '服务不可用';
            setGenerationError(message);
            toast.error(`生成失败: ${message}`);
            setViewState('input');
        }
    }, [
        activeExamId,
        answerImage,
        grade,
        questionImage,
        questionNo,
        questionType,
        selectedExam?.name,
        strategyType,
        subject
    ]);

    const normalizeRubricForPersistence = useCallback((rubric: RubricJSONV3): RubricJSONV3 => {
        return {
            ...rubric,
            metadata: {
                ...rubric.metadata,
                examId: activeExamId || rubric.metadata.examId || null,
                examName: selectedExam?.name || rubric.metadata.examName || '',
                subject: subject || rubric.metadata.subject,
                grade: grade || rubric.metadata.grade,
                questionType: questionType || rubric.metadata.questionType,
                questionId: rubric.metadata.questionId || questionNo.trim()
            }
        };
    }, [activeExamId, grade, questionNo, questionType, selectedExam?.name, subject]);

    const persistRubric = useCallback(async (
        rubric: RubricJSONV3,
        options?: { lifecycleStatus?: 'draft' | 'published' }
    ) => {
        const normalizedRubric = normalizeRubricForPersistence(rubric);
        const resolvedKey = selectedQuestionKey
            || findExistingQuestionKey(normalizedRubric)
            || buildManualQuestionKey(normalizedRubric);

        setRubricConfig(resolvedKey, normalizedRubric);
        await saveRubric(
            JSON.stringify(normalizedRubric, null, 2),
            resolvedKey,
            { lifecycleStatus: options?.lifecycleStatus || 'draft' }
        );
        await loadConfiguredQuestions();

        setSelectedQuestionKey(resolvedKey);
        setGeneratedRubric(normalizedRubric);
        return { normalizedRubric, resolvedKey };
    }, [
        buildManualQuestionKey,
        findExistingQuestionKey,
        loadConfiguredQuestions,
        normalizeRubricForPersistence,
        saveRubric,
        selectedQuestionKey,
        setRubricConfig
    ]);

    const handleSaveRubric = useCallback(async (rubric: RubricJSONV3) => {
        try {
            const { resolvedKey } = await persistRubric(rubric, { lifecycleStatus: 'draft' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'draft');
            toast.success('评分细则已保存');

            setViewState('list');
            resetInputState();
        } catch (error) {
            console.error('[RubricPanel] Save rubric error:', error);
            toast.error('保存失败，请重试');
        }
    }, [
        persistRubric,
        resetInputState
    ]);

    const handleSaveTemplate = useCallback(async (rubric: RubricJSONV3) => {
        const templateValidation = validateRubricForTemplate(rubric);
        if (templateValidation.errors.length > 0) {
            toast.error(templateValidation.errors[0] || '模板校验未通过');
            return;
        }

        try {
            const { normalizedRubric: savedRubric, resolvedKey } = await persistRubric(rubric, { lifecycleStatus: 'draft' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'draft');
            await createRubricTemplate(savedRubric, 'user', {
                questionKey: resolvedKey,
                lifecycleStatus: 'published'
            });
            await persistRubric(savedRubric, { lifecycleStatus: 'published' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'published');
            toast.success('模板已保存到模板库');
            setViewState('list');
            resetInputState();
        } catch (error) {
            console.error('[RubricPanel] Save template error:', error);
            const message = error instanceof Error ? error.message : '模板保存失败';
            toast.error(message);
            throw error;
        }
    }, [persistRubric, resetInputState]);

    const handleRegenerate = useCallback(() => {
        setViewState('input');
        setGenerationError(null);
    }, []);

    const hasQuestionNo = questionNo.trim().length > 0;
    const hasPrimaryInput = Boolean(answerImage);
    const hasExam = Boolean(activeExamId);

    if (viewState === 'welcome') {
        return (
            <div className="flex h-full flex-col bg-[#F5F4F1]">
                <header className="flex h-14 items-center border-b border-[#F0EFED] bg-white px-4">
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-black tracking-tight text-[#1A1918]">评分细则工作台</h1>
                        <p className="text-[10px] font-bold text-[#9C9B99]">先创建或导入细则，再发布为模板</p>
                    </div>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-20">
                    <section className="rounded-2xl border border-[#E7E5E4] bg-white p-4 shadow-sm">
                        <h2 className="text-[13px] font-black text-[#1A1918]">开始你的评分细则流程</h2>
                        <p className="mt-1 text-[11px] font-semibold text-[#78716C]">
                            推荐流程：生成评分细则 → 人工微调 → 保存为模板
                        </p>
                    </section>

                    <button
                        type="button"
                        onClick={handleCreateFromGuide}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-[#D6E4FF] bg-gradient-to-br from-[#EEF4FF] to-[#F8FAFF] p-4 text-left shadow-[0_6px_18px_rgba(59,130,246,0.12)]"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#1E3A8A]">创建评分细则</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#475569]">上传题目与答案图片，AI 自动生成可编辑细则</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#4B5563]">
                            <Upload className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#1F2937]">导入已有细则</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#6B7280]">导入 Rubric v3 JSON，直接进入编辑与保存</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenTemplateList}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                            <Library className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#312E81]">进入模板库</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#6B7280]">查看系统模板与已保存模板，按学科快速复用</p>
                        </div>
                    </button>

                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportRubricFromGuide}
                        className="hidden"
                    />
                </div>
            </div>
        );
    }

    if (viewState === 'list') {
        return (
            <RubricListView
                onCreateNew={handleCreateNew}
                onSelectRubric={handleSelectRubric}
                onUseTemplate={handleUseTemplate}
            />
        );
    }

    if (viewState === 'generating') {
        return (
            <div className="flex flex-col h-full bg-white">
                <header className="h-11 flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-white animate-pulse" />
                        </div>
                        <h1 className="font-bold text-slate-800 text-sm">AI 正在生成评分细则</h1>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-medium">预计 5-10 秒</span>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="w-8 h-8 text-indigo-500" />
                        </div>
                    </div>

                    <div className="text-center max-w-[240px]">
                        <p className="text-sm font-medium text-slate-800">{GENERATING_MESSAGES[generationStep]}</p>
                        <p className="text-xs text-slate-400 mt-1">请保持页面稳定，避免频繁切换标签</p>
                    </div>

                    <div className="w-full max-w-[220px]">
                        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400 transition-all duration-500"
                                style={{ width: `${generatingProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (viewState === 'result' && generatedRubric) {
        return (
            <RubricResultView
                rubric={generatedRubric}
                examName={selectedExam?.name || ''}
                subject={subject}
                questionNo={questionNo}
                onSave={handleSaveRubric}
                onRegenerate={handleRegenerate}
                onSaveTemplate={handleSaveTemplate}
                defaultDensity="compact"
            />
        );
    }

    return (
        <div className="flex h-full flex-col bg-[#F5F4F1]">
            <header className="flex h-14 items-center border-b border-[#F0EFED] bg-white px-4">
                <button
                    onClick={handleBackToList}
                    className="mr-2 flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E5E4E1] bg-[#F5F4F1] text-[#4A4947]"
                    aria-label="返回列表"
                >
                    <ChevronLeft className="h-[18px] w-[18px]" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-[14px] font-black text-[#1A1918]">AI 智能生成</h1>
                    <p className="text-[9px] font-bold uppercase text-[#9C9B99]">AI Rubric Generator</p>
                </div>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
                {generationError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-red-700">{generationError}</p>
                        </div>
                    </div>
                )}

                <section>
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[#4F46E5]">
                        <Info className="h-3 w-3" />
                        <h2 className="text-[11px] font-extrabold">配置基本信息</h2>
                    </div>

                    <div className="space-y-2 rounded-xl border border-[#E5E4E1] bg-[#F8F9FA] p-3">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">考试</label>
                                <div className="relative">
                                    <select
                                        value={activeExamId || ''}
                                        onChange={(e) => {
                                            if (e.target.value === 'new') {
                                                setShowNewExamInput(true);
                                            } else {
                                                setActiveExamId(e.target.value);
                                                setShowNewExamInput(false);
                                            }
                                        }}
                                        className="h-9 w-full appearance-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 pr-7 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                    >
                                        <option value="">选择考试</option>
                                        {exams.map((exam) => (
                                            <option key={exam.id} value={exam.id}>{exam.name}</option>
                                        ))}
                                        <option value="new">新建考试</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">年级</label>
                                <div className="relative">
                                    <select
                                        value={grade}
                                        onChange={(e) => setGrade(e.target.value)}
                                        className="h-9 w-full appearance-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 pr-7 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                    >
                                        {GRADE_OPTIONS.map((item) => (
                                            <option key={item} value={item}>{item}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">科目</label>
                                <div className="relative">
                                    <select
                                        value={subject}
                                        onChange={(e) => {
                                            const nextSubject = e.target.value;
                                            const nextType = getQuestionTypeOptions(nextSubject)[0]?.value || defaultQuestionType;
                                            setSubject(nextSubject);
                                            setQuestionType(nextType);
                                            setStrategyType(inferStrategyTypeByQuestionType(nextSubject, nextType));
                                        }}
                                        className="h-9 w-full appearance-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 pr-7 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                    >
                                        {SUBJECT_OPTIONS.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">题号</label>
                                <input
                                    value={questionNo}
                                    onChange={(e) => setQuestionNo(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-[#E5E4E1] bg-white px-2.5 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">题型</label>
                                <div className="relative">
                                    <select
                                        value={questionType}
                                        onChange={(e) => {
                                            const nextType = e.target.value;
                                            setQuestionType(nextType);
                                            setStrategyType(inferStrategyTypeByQuestionType(subject, nextType, strategyType));
                                        }}
                                        className="h-9 w-full appearance-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 pr-7 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                    >
                                        {questionTypeOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#9C9B99]">策略</label>
                                <div className="relative">
                                    <select
                                        value={strategyType}
                                        onChange={(e) => setStrategyType(e.target.value as StrategyType)}
                                        className="h-9 w-full appearance-none rounded-lg border border-[#E5E4E1] bg-white px-2.5 pr-7 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                    >
                                        {RUBRIC_STRATEGY_OPTIONS.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {showNewExamInput && (
                            <div className="flex gap-2 pt-1">
                                <input
                                    value={newExamName}
                                    onChange={(e) => setNewExamName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateExam()}
                                    placeholder="输入考试名称"
                                    className="h-9 flex-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-semibold text-[#4A4947] outline-none focus:border-blue-300"
                                />
                                <button
                                    onClick={handleCreateExam}
                                    className="h-9 rounded-lg bg-blue-500 px-3 text-[11px] font-bold text-white"
                                >
                                    创建
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <section>
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-[#F0FDF4] px-2 py-0.5 text-[#166534]">
                        <ImageIcon className="h-3 w-3" />
                        <h2 className="text-[11px] font-extrabold">上传视觉资料</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="group relative flex aspect-[1/1.1] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[#E5E4E1] bg-[#F8FAFC] transition-all hover:border-blue-400 hover:bg-[#EFF6FF]">
                            {questionImage ? (
                                <>
                                    <img src={questionImage} alt="试题图片" className="h-full w-full rounded-[18px] object-cover" />
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            setQuestionImage(null);
                                        }}
                                        className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white"
                                        aria-label="移除试题图片"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Camera className="h-5 w-5 text-[#94A3B8]" />
                                    <span className="text-[10px] font-extrabold text-[#64748B]">试题照片</span>
                                </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('question')} />
                        </label>

                        <label className={`group relative flex aspect-[1/1.1] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 transition-all ${answerImage
                            ? 'border-blue-500 bg-[#EFF6FF]'
                            : 'border-dashed border-[#E5E4E1] bg-[#F8FAFC] hover:border-blue-400 hover:bg-[#EFF6FF]'
                            }`}>
                            {answerImage ? (
                                <>
                                    <img src={answerImage} alt="答案图片" className="h-full w-full rounded-[18px] object-cover" />
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            setAnswerImage(null);
                                        }}
                                        className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white"
                                        aria-label="移除答案图片"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <FileCheck2 className="h-5 w-5 text-blue-500" />
                                    <span className="text-[10px] font-extrabold text-blue-500">答案照片</span>
                                </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('answer')} />
                        </label>
                    </div>

                    {!hasPrimaryInput && (
                        <p className="mt-2 text-[10px] font-bold text-[#9C9B99]">请至少上传答案照片后再生成</p>
                    )}
                </section>

                {!hasExam && (
                    <p className="rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 text-[10px] font-semibold text-[#92400E]">
                        未选择考试将以未分组状态保存
                    </p>
                )}
            </div>

            <div className="border-t border-[#F0EFED] bg-white p-4 pb-20">
                <button
                    onClick={handleGenerate}
                    disabled={!hasQuestionNo || !hasPrimaryInput}
                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] text-[14px] font-black text-white shadow-[0_4px_15px_rgba(124,58,237,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Sparkles className="h-[18px] w-[18px]" />
                    一键生成评分细则
                </button>
                <p className="mt-2 text-center text-[9px] font-bold text-[#9C9B99]">AI 智能识别图片内容 · 生成评分后可自由微调</p>
            </div>
        </div>
    );
}
