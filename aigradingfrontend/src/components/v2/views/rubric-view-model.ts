import type {
    PointAccumulationContent,
    RubricMatrixContent,
    SequentialLogicContent,
    RubricConstraint,
    RubricJSONV3,
    RubricPoint,
    ScoringStrategy,
    StrategyType
} from '@/types/rubric-v3';

export type RubricDensity = 'compact' | 'full';

export interface EditableMatrixLevel {
    label: string;
    score: number;
    description?: string;
}

export interface EditableItem {
    id: string;
    content: string;
    score: number;
    keywords: string[];
    requiredKeywords: string[];
    questionSegment?: string;
    deductionRules?: string;
    openEnded: boolean;
    levels?: EditableMatrixLevel[];
}

export interface RubricItemCompleteness {
    missingContent: boolean;
    missingKeywords: boolean;
    missingQuestionSegment: boolean;
    missingRequiredKeywords: boolean;
}

export interface RubricOverview {
    totalScore: number;
    itemCount: number;
    missingKeywordsCount: number;
    missingContentCount: number;
    riskCount: number;
}

function sumScores(scores: number[]): number {
    return scores.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function ensureKeywordList(keywords?: string[]): string[] {
    if (!keywords || keywords.length === 0) return [];
    return keywords.map((keyword) => keyword.trim()).filter(Boolean);
}

function normalizeScore(raw: unknown, fallback = 0): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return value;
}

function asMatrixContent(rubric: RubricJSONV3): RubricMatrixContent {
    return rubric.content as RubricMatrixContent;
}

function asSequentialContent(rubric: RubricJSONV3): SequentialLogicContent {
    return rubric.content as SequentialLogicContent;
}

function asPointContent(rubric: RubricJSONV3): PointAccumulationContent {
    return rubric.content as PointAccumulationContent;
}

export function getRubricTotalScore(rubric: RubricJSONV3): number {
    if (rubric.strategyType === 'rubric_matrix') {
        const content = asMatrixContent(rubric);
        return content.totalScore
            ?? sumScores(content.dimensions.map((dimension) => normalizeScore(dimension.weight, 0)));
    }

    if (rubric.strategyType === 'sequential_logic') {
        const content = asSequentialContent(rubric);
        return content.totalScore
            ?? sumScores(content.steps.map((step) => normalizeScore(step.score, 0)));
    }

    const content = asPointContent(rubric);
    return content.totalScore
        ?? sumScores(content.points.map((point) => normalizeScore(point.score, 0)));
}

export function getScoringStrategy(rubric: RubricJSONV3): ScoringStrategy | null {
    if (rubric.strategyType === 'rubric_matrix') return null;
    return rubric.strategyType === 'sequential_logic'
        ? asSequentialContent(rubric).scoringStrategy
        : asPointContent(rubric).scoringStrategy;
}

export function toEditableItems(rubric: RubricJSONV3): EditableItem[] {
    if (rubric.strategyType === 'rubric_matrix') {
        const content = asMatrixContent(rubric);
        return content.dimensions.map((dimension, index) => ({
            id: dimension.id || `dimension-${index + 1}`,
            content: dimension.name || '',
            score: normalizeScore(
                dimension.weight,
                Math.max(...dimension.levels.map((level) => normalizeScore(level.score, 0)), 0)
            ),
            keywords: [],
            requiredKeywords: [],
            questionSegment: '评分维度',
            deductionRules: undefined,
            openEnded: false,
            levels: dimension.levels.map((level, levelIndex) => ({
                label: level.label || String.fromCharCode(65 + levelIndex),
                score: normalizeScore(level.score, 0),
                description: level.description || ''
            }))
        }));
    }

    const points = rubric.strategyType === 'sequential_logic'
        ? asSequentialContent(rubric).steps
        : asPointContent(rubric).points;
    return points.map((point, index) => ({
        id: point.id || `${rubric.metadata.questionId || 'Q'}-${index + 1}`,
        content: point.content || '',
        score: normalizeScore(point.score, 0),
        keywords: ensureKeywordList(point.keywords),
        requiredKeywords: ensureKeywordList(point.requiredKeywords),
        questionSegment: point.questionSegment || '',
        deductionRules: point.deductionRules || '',
        openEnded: Boolean(point.openEnded),
    }));
}

function normalizeLevels(item: EditableItem, fallbackScore: number, existingLevels?: EditableMatrixLevel[]): EditableMatrixLevel[] {
    const sourceLevels = item.levels && item.levels.length > 0
        ? item.levels
        : (existingLevels && existingLevels.length > 0 ? existingLevels : undefined);

    if (!sourceLevels) {
        return [
            {
                label: 'A',
                score: normalizeScore(item.score, fallbackScore),
                description: item.content
            }
        ];
    }

    return sourceLevels.map((level, index) => ({
        label: (level.label || String.fromCharCode(65 + index)).trim(),
        score: normalizeScore(level.score, fallbackScore),
        description: level.description || ''
    }));
}

function mapEditablePoint(item: EditableItem, questionId: string, index: number): RubricPoint {
    return {
        id: item.id || `${questionId}-${index + 1}`,
        questionSegment: item.questionSegment?.trim() || undefined,
        content: item.content.trim(),
        keywords: ensureKeywordList(item.keywords),
        requiredKeywords: ensureKeywordList(item.requiredKeywords),
        score: normalizeScore(item.score, 0),
        deductionRules: item.deductionRules?.trim() || undefined,
        openEnded: Boolean(item.openEnded)
    };
}

function nextTimestamp(now?: string): string {
    return now || new Date().toISOString();
}

export function applyEditableItems(rubric: RubricJSONV3, items: EditableItem[], now?: string): RubricJSONV3 {
    const updatedAt = nextTimestamp(now);

    if (rubric.strategyType === 'rubric_matrix') {
        const content = asMatrixContent(rubric);
        const existingLevelsMap = new Map<string, EditableMatrixLevel[]>(
            content.dimensions.map((dimension) => [
                dimension.id,
                dimension.levels.map((level, levelIndex) => ({
                    label: level.label || String.fromCharCode(65 + levelIndex),
                    score: normalizeScore(level.score, 0),
                    description: level.description || ''
                }))
            ])
        );

        const dimensions = items.map((item, index) => {
            const score = normalizeScore(item.score, 0);
            const safeId = item.id || `dimension-${index + 1}`;

            return {
                id: safeId,
                name: item.content.trim(),
                weight: score,
                levels: normalizeLevels(item, score, existingLevelsMap.get(safeId))
            };
        });

        return {
            ...rubric,
            content: {
                ...content,
                dimensions,
                totalScore: sumScores(dimensions.map((dimension) => normalizeScore(dimension.weight, 0)))
            },
            updatedAt
        };
    }

    const questionId = rubric.metadata.questionId || 'Q';
    const mapped = items.map((item, index) => mapEditablePoint(item, questionId, index));

    if (rubric.strategyType === 'sequential_logic') {
        const content = asSequentialContent(rubric);
        return {
            ...rubric,
            content: {
                ...content,
                steps: mapped.map((point, index) => ({ ...point, order: index + 1 })),
                totalScore: sumScores(mapped.map((point) => normalizeScore(point.score, 0)))
            },
            updatedAt
        };
    }

    const content = asPointContent(rubric);
    return {
        ...rubric,
        content: {
            ...content,
            points: mapped,
            totalScore: sumScores(mapped.map((point) => normalizeScore(point.score, 0)))
        },
        updatedAt
    };
}

export function createEmptyEditableItem(strategyType: StrategyType, questionId: string, index: number): EditableItem {
    const baseId = `${questionId || 'Q'}-${index + 1}`;

    if (strategyType === 'rubric_matrix') {
        return {
            id: `dimension-${index + 1}`,
            content: '',
            score: 1,
            keywords: [],
            requiredKeywords: [],
            questionSegment: '评分维度',
            openEnded: false,
            levels: [
                { label: 'A', score: 1, description: '' }
            ]
        };
    }

    return {
        id: baseId,
        content: '',
        score: 1,
        keywords: [],
        requiredKeywords: [],
        questionSegment: '',
        deductionRules: '',
        openEnded: false
    };
}

export function getItemCompleteness(item: EditableItem, strategyType: StrategyType): RubricItemCompleteness {
    const missingContent = item.content.trim().length === 0;
    const missingQuestionSegment = strategyType !== 'rubric_matrix' && item.questionSegment?.trim().length === 0;
    const missingKeywords = strategyType !== 'rubric_matrix' && !item.openEnded && item.keywords.length === 0;
    const missingRequiredKeywords = strategyType !== 'rubric_matrix' && !item.openEnded && item.requiredKeywords.length === 0;

    return {
        missingContent,
        missingKeywords,
        missingQuestionSegment: Boolean(missingQuestionSegment),
        missingRequiredKeywords
    };
}

export function buildRubricOverview(rubric: RubricJSONV3): RubricOverview {
    const items = toEditableItems(rubric);

    let missingKeywordsCount = 0;
    let missingContentCount = 0;

    items.forEach((item) => {
        const completeness = getItemCompleteness(item, rubric.strategyType);
        if (completeness.missingKeywords) missingKeywordsCount += 1;
        if (completeness.missingContent) missingContentCount += 1;
    });

    return {
        totalScore: getRubricTotalScore(rubric),
        itemCount: items.length,
        missingKeywordsCount,
        missingContentCount,
        riskCount: missingKeywordsCount + missingContentCount
    };
}

export function updateScoringStrategy(rubric: RubricJSONV3, patch: Partial<ScoringStrategy>, now?: string): RubricJSONV3 {
    if (rubric.strategyType === 'rubric_matrix') return rubric;
    const content = rubric.strategyType === 'sequential_logic'
        ? asSequentialContent(rubric)
        : asPointContent(rubric);

    return {
        ...rubric,
        content: {
            ...content,
            scoringStrategy: {
                ...content.scoringStrategy,
                ...patch
            }
        },
        updatedAt: nextTimestamp(now)
    };
}

export function updateConstraints(rubric: RubricJSONV3, constraints: RubricConstraint[], now?: string): RubricJSONV3 {
    return {
        ...rubric,
        constraints,
        updatedAt: nextTimestamp(now)
    };
}
