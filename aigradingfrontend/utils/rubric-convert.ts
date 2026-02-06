import type { RubricJSONV3 } from '../types/rubric-v3';

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function validateRubricV3(data: unknown): { valid: boolean; errors: string[]; rubric?: RubricJSONV3 } {
    const errors: string[] = [];

    if (!isObject(data)) {
        return { valid: false, errors: ['评分细则必须是对象'] };
    }

    if (data.version !== '3.0') {
        errors.push('version 必须为 3.0');
    }

    const allowedTopLevelKeys = new Set(['version', 'metadata', 'strategyType', 'content', 'constraints', 'createdAt', 'updatedAt']);
    const forbiddenTopLevelKeys = ['questionId', 'title', 'totalScore', 'scoringStrategy', 'answerPoints', 'gradingNotes', 'legacy'];
    for (const key of Object.keys(data)) {
        if (!allowedTopLevelKeys.has(key)) {
            errors.push(`包含未知字段: ${key}`);
        }
    }
    for (const key of forbiddenTopLevelKeys) {
        if (key in data) {
            errors.push(`检测到旧版字段: ${key}`);
        }
    }

    const metadata = data.metadata;
    if (!isObject(metadata)) {
        errors.push('metadata 必须存在');
    } else {
        if (!hasString(metadata.questionId)) errors.push('metadata.questionId 必填');
        if (!hasString(metadata.title)) errors.push('metadata.title 必填');
    }

    const strategyType = data.strategyType;
    if (!['point_accumulation', 'sequential_logic', 'rubric_matrix'].includes(String(strategyType))) {
        errors.push('strategyType 非法');
    }

    if (!isObject(data.content)) {
        errors.push('content 必须存在');
    } else {
        if ('answerPoints' in data.content || 'gradingNotes' in data.content) {
            errors.push('content 中检测到旧版字段');
        }
        if (strategyType === 'point_accumulation') {
            const points = data.content.points;
            if (!Array.isArray(points) || points.length === 0) {
                errors.push('point_accumulation 需要至少 1 个 points');
            }
        }
        if (strategyType === 'sequential_logic') {
            const steps = data.content.steps;
            if (!Array.isArray(steps) || steps.length === 0) {
                errors.push('sequential_logic 需要至少 1 个 steps');
            }
        }
        if (strategyType === 'rubric_matrix') {
            const dimensions = data.content.dimensions;
            if (!Array.isArray(dimensions) || dimensions.length === 0) {
                errors.push('rubric_matrix 需要至少 1 个 dimensions');
            }
        }
    }

    if (!hasString(data.createdAt)) errors.push('createdAt 必填');
    if (!hasString(data.updatedAt)) errors.push('updatedAt 必填');

    if (errors.length > 0) {
        return { valid: false, errors };
    }
    return { valid: true, errors: [], rubric: data as unknown as RubricJSONV3 };
}

export function coerceRubricToV3(data: unknown): { rubric: RubricJSONV3; converted: boolean } {
    const validation = validateRubricV3(data);
    if (!validation.valid || !validation.rubric) {
        throw new Error(`仅支持 Rubric v3: ${validation.errors.join(', ')}`);
    }
    return { rubric: validation.rubric, converted: false };
}
