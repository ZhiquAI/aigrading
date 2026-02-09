import type { StrategyType } from '@/types/rubric-v3';

export interface RubricQuestionTypeOption {
    value: string;
    label: string;
    strategyType: StrategyType;
}

export interface RubricSubjectOption {
    value: string;
    label: string;
    badgeClass: string;
    questionTypes: RubricQuestionTypeOption[];
}

export interface RubricStrategyOption {
    value: StrategyType;
    label: string;
    description: string;
}

export const RUBRIC_STRATEGY_OPTIONS: RubricStrategyOption[] = [
    {
        value: 'point_accumulation',
        label: '得分点累加',
        description: '按关键词和得分点累加计分'
    },
    {
        value: 'sequential_logic',
        label: '步骤逻辑',
        description: '按解题步骤顺序和完整性给分'
    },
    {
        value: 'rubric_matrix',
        label: '维度矩阵',
        description: '按维度等级进行分层评价'
    }
];

export const RUBRIC_SUBJECT_OPTIONS: RubricSubjectOption[] = [
    {
        value: '语文',
        label: '语文',
        badgeClass: 'bg-rose-100 text-rose-700',
        questionTypes: [
            { value: '阅读理解', label: '阅读理解', strategyType: 'point_accumulation' },
            { value: '文言文', label: '文言文', strategyType: 'point_accumulation' },
            { value: '作文', label: '作文', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '英语',
        label: '英语',
        badgeClass: 'bg-sky-100 text-sky-700',
        questionTypes: [
            { value: '阅读理解', label: '阅读理解', strategyType: 'point_accumulation' },
            { value: '完型填空', label: '完型填空', strategyType: 'point_accumulation' },
            { value: '作文', label: '作文', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '数学',
        label: '数学',
        badgeClass: 'bg-cyan-100 text-cyan-700',
        questionTypes: [
            { value: '填空题', label: '填空题', strategyType: 'point_accumulation' },
            { value: '证明题', label: '证明题', strategyType: 'sequential_logic' },
            { value: '计算题', label: '计算题', strategyType: 'sequential_logic' }
        ]
    },
    {
        value: '物理',
        label: '物理',
        badgeClass: 'bg-violet-100 text-violet-700',
        questionTypes: [
            { value: '填空题', label: '填空题', strategyType: 'point_accumulation' },
            { value: '计算题', label: '计算题', strategyType: 'sequential_logic' },
            { value: '实验题', label: '实验题', strategyType: 'sequential_logic' }
        ]
    },
    {
        value: '化学',
        label: '化学',
        badgeClass: 'bg-pink-100 text-pink-700',
        questionTypes: [
            { value: '填空题', label: '填空题', strategyType: 'point_accumulation' },
            { value: '计算题', label: '计算题', strategyType: 'sequential_logic' },
            { value: '实验题', label: '实验题', strategyType: 'sequential_logic' }
        ]
    },
    {
        value: '道法',
        label: '道法',
        badgeClass: 'bg-orange-100 text-orange-700',
        questionTypes: [
            { value: '材料题', label: '材料题', strategyType: 'point_accumulation' },
            { value: '简答题', label: '简答题', strategyType: 'point_accumulation' },
            { value: '辨析题', label: '辨析题', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '历史',
        label: '历史',
        badgeClass: 'bg-amber-100 text-amber-700',
        questionTypes: [
            { value: '填空题', label: '填空题', strategyType: 'point_accumulation' },
            { value: '材料题', label: '材料题', strategyType: 'point_accumulation' },
            { value: '论述题', label: '论述题', strategyType: 'rubric_matrix' }
        ]
    }
];

const FALLBACK_QUESTION_TYPES: RubricQuestionTypeOption[] = [
    { value: '材料题', label: '材料题', strategyType: 'point_accumulation' }
];

export function getSubjectOption(subject: string): RubricSubjectOption | undefined {
    return RUBRIC_SUBJECT_OPTIONS.find((item) => item.value === subject);
}

export function getSubjectOptions(): RubricSubjectOption[] {
    return RUBRIC_SUBJECT_OPTIONS;
}

export function getQuestionTypeOptions(subject: string): RubricQuestionTypeOption[] {
    return getSubjectOption(subject)?.questionTypes || FALLBACK_QUESTION_TYPES;
}

export function inferStrategyTypeByQuestionType(
    subject: string,
    questionType: string,
    fallback: StrategyType = 'point_accumulation'
): StrategyType {
    const option = getQuestionTypeOptions(subject).find((item) => item.value === questionType);
    return option?.strategyType || fallback;
}

export function getStrategyLabel(strategyType: StrategyType): string {
    return RUBRIC_STRATEGY_OPTIONS.find((item) => item.value === strategyType)?.label || strategyType;
}

export function getSubjectBadgeClass(subject?: string): string {
    if (!subject) return 'bg-slate-100 text-slate-600';
    return getSubjectOption(subject)?.badgeClass || 'bg-slate-100 text-slate-600';
}
