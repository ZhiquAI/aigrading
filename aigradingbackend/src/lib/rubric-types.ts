import { RubricJSONV3, validateRubricV3 } from './rubric-v3';

export type RubricJSON = RubricJSONV3;

export interface RubricListItem {
    questionId: string;
    title: string;
    totalScore: number;
    pointCount: number;
    updatedAt: string;
}

export function validateRubricJSON(data: unknown): {
    valid: boolean;
    errors: string[];
    rubric?: RubricJSON;
} {
    return validateRubricV3(data);
}

export function getRubricTotalScore(rubric: RubricJSON): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = rubric.content as any;
    const segments = Array.isArray(content?.segments) ? content.segments : [];

    if (segments.length > 0) {
        if (typeof content.totalScore === 'number') return content.totalScore;
        const aggregation = content.aggregation === 'weighted_sum' || content.aggregation === 'max' ? content.aggregation : 'sum';
        const segmentMaxList = segments.map((segment: any) => {
            if (typeof segment?.maxScore === 'number') return Math.max(0, segment.maxScore);
            const segmentContent = segment?.content || {};
            if (segment?.strategyType === 'rubric_matrix') {
                if (typeof segmentContent.totalScore === 'number') return segmentContent.totalScore;
                return (segmentContent.dimensions || []).reduce((sum: number, dim: any) => sum + (dim.weight || 0), 0);
            }
            if (segment?.strategyType === 'sequential_logic') {
                if (typeof segmentContent.totalScore === 'number') return segmentContent.totalScore;
                return (segmentContent.steps || []).reduce((sum: number, step: any) => sum + (step.score || 0), 0);
            }
            if (typeof segmentContent.totalScore === 'number') return segmentContent.totalScore;
            return (segmentContent.points || []).reduce((sum: number, point: any) => sum + (point.score || 0), 0);
        });

        if (aggregation === 'max') {
            return segmentMaxList.reduce((max: number, value: number) => Math.max(max, value || 0), 0);
        }
        if (aggregation === 'weighted_sum') {
            return segments.reduce((sum: number, segment: any, index: number) => {
                const weight = typeof segment?.weight === 'number' ? Math.max(0, segment.weight) : Math.max(0, segmentMaxList[index] || 0);
                return sum + weight;
            }, 0);
        }
        return segmentMaxList.reduce((sum: number, value: number) => sum + (value || 0), 0);
    }

    if (rubric.strategyType === 'rubric_matrix') {
        if (typeof content.totalScore === 'number') return content.totalScore;
        return (content.dimensions || []).reduce((sum: number, dim: any) => sum + (dim.weight || 0), 0);
    }
    if (rubric.strategyType === 'sequential_logic') {
        if (typeof content.totalScore === 'number') return content.totalScore;
        return (content.steps || []).reduce((sum: number, step: any) => sum + (step.score || 0), 0);
    }
    if (typeof content.totalScore === 'number') return content.totalScore;
    return (content.points || []).reduce((sum: number, point: any) => sum + (point.score || 0), 0);
}

export function getRubricPointCount(rubric: RubricJSON): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = rubric.content as any;
    const segments = Array.isArray(content?.segments) ? content.segments : [];

    if (segments.length > 0) {
        return segments.reduce((sum: number, segment: any) => {
            const segmentContent = segment?.content || {};
            if (segment?.strategyType === 'rubric_matrix') return sum + (segmentContent.dimensions?.length ?? 0);
            if (segment?.strategyType === 'sequential_logic') return sum + (segmentContent.steps?.length ?? 0);
            return sum + (segmentContent.points?.length ?? 0);
        }, 0);
    }

    if (rubric.strategyType === 'rubric_matrix') return content.dimensions?.length ?? 0;
    if (rubric.strategyType === 'sequential_logic') return content.steps?.length ?? 0;
    return content.points?.length ?? 0;
}

export function rubricToListItem(rubric: RubricJSON): RubricListItem {
    return {
        questionId: rubric.metadata.questionId,
        title: rubric.metadata.title,
        totalScore: getRubricTotalScore(rubric),
        pointCount: getRubricPointCount(rubric),
        updatedAt: rubric.updatedAt,
    };
}
