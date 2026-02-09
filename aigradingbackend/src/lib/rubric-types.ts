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
