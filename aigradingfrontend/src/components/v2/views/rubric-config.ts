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

const SUBJECT_ALIASES: Record<string, string> = {
    政治: '道法'
};

export function normalizeSubjectValue(subject?: string): string {
    const raw = (subject || '').trim();
    return SUBJECT_ALIASES[raw] || raw;
}

const QUESTION_TYPE_ALIASES: Record<string, Record<string, string>> = {
    历史: {
        材料题: '材料解析题',
        非选择题: '非选择题',
        材料运用与论述: '历史探究题',
        史事论述: '历史探究题'
    },
    道法: {
        材料题: '材料分析题',
        非选择题: '非选择题',
        分析说明题: '材料分析题',
        综合探究题: '实践探究题'
    },
    语文: {
        现代文阅读: '综合阅读',
        古诗文阅读: '综合阅读',
        写作: '作文'
    },
    英语: {
        完型填空: '完形填空',
        交流与表达: '交流与表达',
        写作: '书面表达'
    },
    化学: {
        填空简答题: '填空及简答题',
        计算题: '计算与分析题'
    }
};

export function normalizeQuestionTypeValue(subject: string, questionType?: string): string {
    const normalizedSubject = normalizeSubjectValue(subject);
    const raw = (questionType || '').trim();
    if (!raw) return raw;
    const subjectAliases = QUESTION_TYPE_ALIASES[normalizedSubject] || {};
    return subjectAliases[raw] || raw;
}

export const RUBRIC_STRATEGY_OPTIONS: RubricStrategyOption[] = [
    {
        value: 'point_accumulation',
        label: '按点给分',
        description: '按得分点命中情况累计计分'
    },
    {
        value: 'sequential_logic',
        label: '步骤给分',
        description: '按解题步骤的顺序与完整性给分'
    },
    {
        value: 'rubric_matrix',
        label: '分档评分',
        description: '按评分维度与等级分档给分'
    }
];

export const RUBRIC_SUBJECT_OPTIONS: RubricSubjectOption[] = [
    {
        value: '历史',
        label: '历史',
        badgeClass: 'bg-amber-100 text-amber-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '材料解析题', label: '材料解析题', strategyType: 'point_accumulation' },
            { value: '非选择题', label: '非选择题', strategyType: 'point_accumulation' },
            { value: '历史探究题', label: '历史探究题', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '道法',
        label: '道法',
        badgeClass: 'bg-orange-100 text-orange-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '非选择题', label: '非选择题', strategyType: 'point_accumulation' },
            { value: '材料分析题', label: '材料分析题', strategyType: 'point_accumulation' },
            { value: '简答题', label: '简答题', strategyType: 'point_accumulation' },
            { value: '辨析题', label: '辨析题', strategyType: 'rubric_matrix' },
            { value: '实践探究题', label: '实践探究题', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '地理',
        label: '地理',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '地理实验题', label: '地理实验题', strategyType: 'sequential_logic' },
            { value: '地理思辨题', label: '地理思辨题', strategyType: 'point_accumulation' },
            { value: '地理探究题', label: '地理探究题', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '生物',
        label: '生物',
        badgeClass: 'bg-lime-100 text-lime-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '实验探究题', label: '实验探究题', strategyType: 'sequential_logic' },
            { value: '综合分析题', label: '综合分析题', strategyType: 'point_accumulation' }
        ]
    },
    {
        value: '语文',
        label: '语文',
        badgeClass: 'bg-rose-100 text-rose-700',
        questionTypes: [
            { value: '语言运用', label: '语言运用', strategyType: 'point_accumulation' },
            { value: '综合阅读', label: '综合阅读', strategyType: 'point_accumulation' },
            { value: '现代文阅读', label: '现代文阅读', strategyType: 'point_accumulation' },
            { value: '古诗文阅读', label: '古诗文阅读', strategyType: 'point_accumulation' },
            { value: '作文', label: '作文', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '英语',
        label: '英语',
        badgeClass: 'bg-sky-100 text-sky-700',
        questionTypes: [
            { value: '听力题', label: '听力题', strategyType: 'point_accumulation' },
            { value: '完形填空', label: '完形填空', strategyType: 'point_accumulation' },
            { value: '阅读理解', label: '阅读理解', strategyType: 'point_accumulation' },
            { value: '完成句子', label: '完成句子', strategyType: 'point_accumulation' },
            { value: '短文填空', label: '短文填空', strategyType: 'point_accumulation' },
            { value: '任务型阅读', label: '任务型阅读', strategyType: 'point_accumulation' },
            { value: '补全对话', label: '补全对话', strategyType: 'point_accumulation' },
            { value: '交流与表达', label: '交流与表达', strategyType: 'rubric_matrix' },
            { value: '书面表达', label: '书面表达', strategyType: 'rubric_matrix' }
        ]
    },
    {
        value: '数学',
        label: '数学',
        badgeClass: 'bg-cyan-100 text-cyan-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '填空题', label: '填空题', strategyType: 'point_accumulation' },
            { value: '解答题', label: '解答题', strategyType: 'sequential_logic' },
            { value: '问题探究题', label: '问题探究题', strategyType: 'sequential_logic' }
        ]
    },
    {
        value: '物理',
        label: '物理',
        badgeClass: 'bg-violet-100 text-violet-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '填空与作图题', label: '填空与作图题', strategyType: 'sequential_logic' },
            { value: '实验与探究题', label: '实验与探究题', strategyType: 'sequential_logic' },
            { value: '综合题', label: '综合题', strategyType: 'sequential_logic' }
        ]
    },
    {
        value: '化学',
        label: '化学',
        badgeClass: 'bg-pink-100 text-pink-700',
        questionTypes: [
            { value: '选择题', label: '选择题', strategyType: 'point_accumulation' },
            { value: '填空及简答题', label: '填空及简答题', strategyType: 'point_accumulation' },
            { value: '实验及探究题', label: '实验及探究题', strategyType: 'sequential_logic' },
            { value: '计算与分析题', label: '计算与分析题', strategyType: 'sequential_logic' }
        ]
    }
];

const FALLBACK_QUESTION_TYPES: RubricQuestionTypeOption[] = [
    { value: '材料题', label: '材料题', strategyType: 'point_accumulation' }
];

export function getSubjectOption(subject: string): RubricSubjectOption | undefined {
    const normalized = normalizeSubjectValue(subject);
    return RUBRIC_SUBJECT_OPTIONS.find((item) => item.value === normalized);
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
    const normalizedQuestionType = normalizeQuestionTypeValue(subject, questionType);
    const option = getQuestionTypeOptions(subject).find((item) => item.value === normalizedQuestionType);
    return option?.strategyType || fallback;
}

export function getStrategyLabel(strategyType: StrategyType): string {
    return RUBRIC_STRATEGY_OPTIONS.find((item) => item.value === strategyType)?.label || strategyType;
}

export function getSubjectBadgeClass(subject?: string): string {
    if (!subject) return 'bg-slate-100 text-slate-600';
    return getSubjectOption(subject)?.badgeClass || 'bg-slate-100 text-slate-600';
}
