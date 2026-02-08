import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, FileText, Layers, Library, Pencil, Plus, Rocket, Search, Sparkles } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import type { RubricJSONV3, StrategyType } from '@/types/rubric-v3';
import {
    RUBRIC_SUBJECT_OPTIONS,
    getQuestionTypeOptions,
    getStrategyLabel,
    getSubjectBadgeClass,
    inferStrategyTypeByQuestionType
} from './rubric-config';
import { validateRubricForTemplate } from './rubric-validator';
import {
    getRubricTemplateLifecycleStatus,
    setRubricTemplateLifecycleStatus,
    type RubricTemplateLifecycleStatus
} from './rubric-template-status';

interface RubricListViewProps {
    onCreateNew: () => void;
    onSelectRubric: (questionKey: string) => void;
    onUseTemplate: (template: RubricTemplateSeed) => void;
}

export interface RubricTemplateSeed {
    id: string;
    source: 'preset' | 'custom';
    lifecycleStatus: RubricTemplateLifecycleStatus;
    subject: string;
    questionType: string;
    strategyType: StrategyType;
    templateTitle: string;
    examId?: string | null;
    examName?: string | null;
    questionKey?: string;
}

interface TemplateCard extends RubricTemplateSeed {
    subtitle: string;
    pointCount: number;
    totalScore: number;
    footerNote: string;
}

const ALL_SUBJECT_TAB = '全部';
type TemplateStatusFilter = 'all' | 'published' | 'draft';

function computeRubricStats(rubric: RubricJSONV3): Pick<TemplateCard, 'pointCount' | 'totalScore' | 'footerNote'> {
    if (rubric.strategyType === 'rubric_matrix') {
        const dims = rubric.content.dimensions || [];
        const total = Number(rubric.content.totalScore)
            || dims.reduce((sum, dim) => sum + (Number(dim.weight) || 0), 0);
        return {
            pointCount: dims.length,
            totalScore: total,
            footerNote: '维度矩阵策略'
        };
    }

    if (rubric.strategyType === 'sequential_logic') {
        const steps = rubric.content.steps || [];
        const total = Number(rubric.content.totalScore)
            || steps.reduce((sum, step) => sum + (Number(step.score) || 0), 0);
        return {
            pointCount: steps.length,
            totalScore: total,
            footerNote: '顺序逻辑策略'
        };
    }

    const points = rubric.content.points || [];
    const total = Number(rubric.content.totalScore)
        || points.reduce((sum, point) => sum + (Number(point.score) || 0), 0);
    return {
        pointCount: points.length,
        totalScore: total,
        footerNote: '关键词累加'
    };
}

function fallbackStatsByStrategy(strategyType: StrategyType): Pick<TemplateCard, 'pointCount' | 'totalScore' | 'footerNote'> {
    if (strategyType === 'rubric_matrix') {
        return { pointCount: 4, totalScore: 12, footerNote: '维度矩阵策略' };
    }
    if (strategyType === 'sequential_logic') {
        return { pointCount: 5, totalScore: 5, footerNote: '顺序逻辑策略' };
    }
    return { pointCount: 6, totalScore: 3, footerNote: '关键词累加' };
}

function getSubjectStripeClass(subject: string): string {
    switch (subject) {
        case '语文': return 'before:bg-rose-500';
        case '英语': return 'before:bg-sky-500';
        case '数学': return 'before:bg-cyan-500';
        case '物理': return 'before:bg-violet-500';
        case '化学': return 'before:bg-pink-500';
        case '道法': return 'before:bg-orange-500';
        case '历史': return 'before:bg-blue-500';
        default: return 'before:bg-slate-300';
    }
}

function getPointLabel(strategyType: StrategyType): string {
    return strategyType === 'rubric_matrix' ? '评分维度' : '采分点';
}

function toTemplateCardsFromLibrary(
    rubricLibrary: Array<{ id: string }>,
    rubricData: Record<string, unknown>,
    examNameById: Map<string, string>
): TemplateCard[] {
    const cards: TemplateCard[] = [];

    for (const item of rubricLibrary || []) {
        const raw = rubricData?.[item.id];
        if (!raw) continue;

        try {
            const rubric = coerceRubricToV3(raw).rubric as RubricJSONV3;
            const subject = (rubric.metadata.subject || RUBRIC_SUBJECT_OPTIONS[0]?.value || '历史').trim();
            const fallbackType = getQuestionTypeOptions(subject)[0]?.value || '材料题';
            const questionType = (rubric.metadata.questionType || fallbackType).trim();
            const strategyType = rubric.strategyType || inferStrategyTypeByQuestionType(subject, questionType);
            const templateTitle = (rubric.metadata.title || `${subject}-${questionType}通用评分模板`).trim();
            const examId = rubric.metadata.examId || null;
            const examName = (rubric.metadata.examName || '').trim() || (examId ? examNameById.get(examId) || null : null);
            const stats = computeRubricStats(rubric);

            cards.push({
                id: `custom:${item.id}`,
                source: 'custom',
                lifecycleStatus: getRubricTemplateLifecycleStatus(item.id, 'published'),
                subject,
                questionType,
                strategyType,
                templateTitle,
                examId,
                examName,
                questionKey: item.id,
                subtitle: '自定义模板',
                ...stats
            });
        } catch {
            continue;
        }
    }

    return cards;
}

function buildPresetTemplateCards(existingCustomCards: TemplateCard[]): TemplateCard[] {
    const customKeys = new Set(
        existingCustomCards.map((card) => `${card.subject}|${card.questionType}|${card.strategyType}`)
    );

    const presetCards: TemplateCard[] = [];

    for (const subject of RUBRIC_SUBJECT_OPTIONS) {
        for (const questionType of subject.questionTypes) {
            const cardKey = `${subject.value}|${questionType.value}|${questionType.strategyType}`;
            if (customKeys.has(cardKey)) continue;
            const fallbackStats = fallbackStatsByStrategy(questionType.strategyType);

            presetCards.push({
                id: `preset:${subject.value}:${questionType.value}`,
                source: 'preset',
                lifecycleStatus: 'published',
                subject: subject.value,
                questionType: questionType.value,
                strategyType: questionType.strategyType,
                templateTitle: `${subject.label}-${questionType.label}通用评分模板`,
                examId: null,
                examName: null,
                subtitle: '系统模板',
                ...fallbackStats
            });
        }
    }

    return presetCards;
}

export default function RubricListView({ onCreateNew, onSelectRubric, onUseTemplate }: RubricListViewProps) {
    const { rubricLibrary, rubricData, exams, activeExamId } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSubject, setActiveSubject] = useState<string>(ALL_SUBJECT_TAB);
    const [examFilter, setExamFilter] = useState<'all' | 'current' | 'unassigned'>('all');
    const [statusFilter, setStatusFilter] = useState<TemplateStatusFilter>('published');
    const [statusVersion, setStatusVersion] = useState(0);

    const currentExamName = useMemo(
        () => exams.find((exam) => exam.id === activeExamId)?.name || '未选择',
        [activeExamId, exams]
    );

    const examNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const exam of exams) {
            map.set(exam.id, exam.name);
        }
        return map;
    }, [exams]);

    const subjectTabs = useMemo(
        () => [ALL_SUBJECT_TAB, ...RUBRIC_SUBJECT_OPTIONS.map((subject) => subject.value)],
        []
    );

    const allTemplates = useMemo(() => {
        const customCards = toTemplateCardsFromLibrary(rubricLibrary || [], rubricData || {}, examNameById);
        const presetCards = buildPresetTemplateCards(customCards);
        return [...customCards, ...presetCards];
    }, [examNameById, rubricData, rubricLibrary, statusVersion]);

    const handlePublishTemplate = useCallback((template: TemplateCard) => {
        if (!template.questionKey) return;
        const raw = rubricData?.[template.questionKey];
        if (!raw) {
            toast.error('未找到草稿细则，无法发布');
            return;
        }

        try {
            const rubric = coerceRubricToV3(raw).rubric;
            const validation = validateRubricForTemplate(rubric);
            if (validation.errors.length > 0) {
                toast.error(validation.errors[0] || '模板校验未通过');
                return;
            }

            setRubricTemplateLifecycleStatus(template.questionKey, 'published');
            setStatusVersion((prev) => prev + 1);
            toast.success('草稿已发布为模板');
        } catch (error) {
            console.error('[RubricListView] publish template error:', error);
            toast.error('发布失败，请重试');
        }
    }, [rubricData]);

    const filteredTemplates = useMemo(() => {
        const search = searchQuery.trim().toLowerCase();

        return allTemplates.filter((template) => {
            const matchSubject = activeSubject === ALL_SUBJECT_TAB || template.subject === activeSubject;
            if (!matchSubject) return false;

            const matchExam = (() => {
                if (examFilter === 'all') return true;
                if (examFilter === 'current') {
                    if (template.source === 'preset') return true;
                    return !!activeExamId && template.examId === activeExamId;
                }
                if (template.source === 'preset') return false;
                return !template.examId;
            })();
            if (!matchExam) return false;

            const matchStatus = statusFilter === 'all' || template.lifecycleStatus === statusFilter;
            if (!matchStatus) return false;

            if (!search) return true;

            const haystack = [
                template.templateTitle,
                template.subject,
                template.questionType,
                getStrategyLabel(template.strategyType),
                template.subtitle
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(search);
        });
    }, [activeExamId, activeSubject, allTemplates, examFilter, searchQuery, statusFilter]);

    return (
        <div className="flex h-full flex-col bg-[#F5F4F1]">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F0EFED] bg-white px-4">
                <div className="flex items-center gap-2">
                    <Library className="h-[18px] w-[18px] text-blue-500" />
                    <h1 className="text-base font-black tracking-tight text-[#1A1918]">评分细则模板</h1>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                        {allTemplates.length}
                    </span>
                </div>
                <button
                    onClick={onCreateNew}
                    aria-label="创建细则模板"
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue-500 text-white shadow-[0_4px_10px_rgba(59,130,246,0.3)] transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </header>

            <div className="border-b border-[#F0EFED] bg-white px-4 py-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="搜索细则模板..."
                        className="h-10 w-full rounded-[10px] border border-[#E5E4E1] bg-[#F8F9FA] pl-10 pr-3 text-[12px] font-semibold text-[#4A4947] placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex overflow-x-auto border-b border-[#F0EFED] bg-white px-4 pt-2 scrollbar-none">
                <div className="flex min-w-max gap-4">
                    {subjectTabs.map((tab) => {
                        const isActive = tab === activeSubject;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveSubject(tab)}
                                className={`h-9 whitespace-nowrap border-b-2 text-[12px] font-extrabold transition-all ${isActive
                                    ? 'border-blue-500 text-blue-500'
                                    : 'border-transparent text-[#9C9B99] hover:text-[#4A4947]'
                                    }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-[#F0EFED] bg-white px-4 py-2 scrollbar-none">
                <button
                    onClick={() => setExamFilter('all')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${examFilter === 'all'
                        ? 'border border-blue-200 bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    全部考试
                </button>
                <button
                    onClick={() => setExamFilter('current')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${examFilter === 'current'
                        ? 'border border-blue-200 bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    当前考试：{currentExamName}
                </button>
                <button
                    onClick={() => setExamFilter('unassigned')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${examFilter === 'unassigned'
                        ? 'border border-blue-200 bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    未分组
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-[#F0EFED] bg-white px-4 py-2 scrollbar-none">
                <button
                    onClick={() => setStatusFilter('published')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${statusFilter === 'published'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    已发布
                </button>
                <button
                    onClick={() => setStatusFilter('draft')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${statusFilter === 'draft'
                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    草稿
                </button>
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${statusFilter === 'all'
                        ? 'border border-blue-200 bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                >
                    全部状态
                </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8F9FA] p-4">
                {filteredTemplates.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                        <h2 className="text-sm font-bold text-slate-700">没有匹配的模板</h2>
                        <p className="mt-1 text-xs text-slate-400">切换学科或更换关键词试试</p>
                    </div>
                )}

                {filteredTemplates.map((template) => {
                    const examLabel = template.source === 'preset' ? '通用模板' : (template.examName || '未分组');
                    const isCurrentExamTemplate = Boolean(activeExamId && template.source === 'custom' && template.examId === activeExamId);
                    return (
                        <article
                            key={template.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onUseTemplate(template)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onUseTemplate(template);
                                }
                            }}
                            className={`relative overflow-hidden rounded-2xl border border-[#E5E4E1] bg-white p-4 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${getSubjectStripeClass(template.subject)} before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${isCurrentExamTemplate ? 'ring-1 ring-blue-300/60' : ''
                                }`}
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <span className={`rounded-md px-2 py-0.5 text-[9px] font-black ${getSubjectBadgeClass(template.subject)}`}>
                                    {template.subject}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black ${template.source === 'custom'
                                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-500'
                                        }`}>
                                        {template.source === 'custom' && <Sparkles className="h-2.5 w-2.5" />}
                                        {template.source === 'custom' ? '自定义' : '系统模板'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black ${template.lifecycleStatus === 'published'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                        }`}>
                                        {template.lifecycleStatus === 'published'
                                            ? (<><CheckCircle2 className="h-2.5 w-2.5" />已发布</>)
                                            : '草稿'}
                                    </span>
                                </div>
                            </div>

                            <h3 className="mb-3 text-[14px] font-black leading-tight text-[#1A1918]">{template.templateTitle}</h3>

                            <div className="mb-3 flex items-baseline gap-4">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[16px] font-black text-[#1A1918]">{template.pointCount}</span>
                                    <span className="text-[10px] font-bold uppercase text-[#9C9B99]">{getPointLabel(template.strategyType)}</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[16px] font-black text-[#1A1918]">{template.totalScore}</span>
                                    <span className="text-[10px] font-bold uppercase text-[#9C9B99]">总分</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-dashed border-[#F0EFED] pt-3">
                                <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[#9C9B99]">
                                    {template.source === 'preset' ? <Layers className="h-3 w-3 shrink-0" /> : <Calendar className="h-3 w-3 shrink-0" />}
                                    <span className="truncate">{template.source === 'preset' ? template.footerNote : examLabel}</span>
                                </div>
                                {template.questionKey ? (
                                    <div className="flex items-center gap-1">
                                        {template.lifecycleStatus === 'draft' && (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePublishTemplate(template);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 transition-colors hover:bg-emerald-100"
                                                aria-label="发布草稿模板"
                                            >
                                                <Rocket className="h-2.5 w-2.5" />
                                                发布
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onSelectRubric(template.questionKey!);
                                            }}
                                            className="rounded-md p-1 text-slate-400 transition-colors hover:text-blue-600"
                                            aria-label="编辑模板"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <FileText className="h-3.5 w-3.5 text-slate-300" />
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
