import type { RubricJSONV3 } from '../types/rubric-v3';

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasArray(value: unknown): value is unknown[] {
    return Array.isArray(value) && value.length > 0;
}

function validateScoringStrategy(
    maybeStrategy: unknown,
    errors: string[],
    path: string
): void {
    if (!isObject(maybeStrategy)) {
        errors.push(`${path} 必须存在`);
        return;
    }

    const strategyType = String(maybeStrategy.type || '');
    if (!['pick_n', 'all', 'weighted'].includes(strategyType)) {
        errors.push(`${path}.type 非法`);
    }
}

function validateContentByStrategy(
    content: Record<string, unknown>,
    strategyType: string,
    errors: string[],
    path: string,
    allowNestedSegments: boolean
): void {
    if ('answerPoints' in content || 'gradingNotes' in content) {
        errors.push(`${path} 中检测到旧版字段`);
    }

    const aggregation = content.aggregation;
    if (
        aggregation !== undefined
        && !['sum', 'weighted_sum', 'max'].includes(String(aggregation))
    ) {
        errors.push(`${path}.aggregation 非法`);
    }

    const segments = content.segments;
    const hasSegments = hasArray(segments);
    if (segments !== undefined && !Array.isArray(segments)) {
        errors.push(`${path}.segments 必须是数组`);
    }

    if (allowNestedSegments && Array.isArray(segments)) {
        segments.forEach((segment, index) => {
            const segmentPath = `${path}.segments[${index}]`;
            if (!isObject(segment)) {
                errors.push(`${segmentPath} 必须是对象`);
                return;
            }

            if (!hasString(segment.id)) {
                errors.push(`${segmentPath}.id 必填`);
            }

            const segmentStrategyType = String(segment.strategyType || '');
            if (!['point_accumulation', 'sequential_logic', 'rubric_matrix'].includes(segmentStrategyType)) {
                errors.push(`${segmentPath}.strategyType 非法`);
            }

            if (!isObject(segment.content)) {
                errors.push(`${segmentPath}.content 必须存在`);
                return;
            }

            validateContentByStrategy(
                segment.content,
                segmentStrategyType,
                errors,
                `${segmentPath}.content`,
                false
            );
        });
    }

    if (strategyType === 'point_accumulation') {
        const points = content.points;
        const hasPoints = hasArray(points);

        if (!hasPoints && !hasSegments) {
            errors.push(`${path} 需要至少 1 个 points 或 segments`);
        }
        if (hasPoints) {
            validateScoringStrategy(content.scoringStrategy, errors, `${path}.scoringStrategy`);
        }
        return;
    }

    if (strategyType === 'sequential_logic') {
        const steps = content.steps;
        const hasSteps = hasArray(steps);

        if (!hasSteps && !hasSegments) {
            errors.push(`${path} 需要至少 1 个 steps 或 segments`);
        }
        if (hasSteps) {
            validateScoringStrategy(content.scoringStrategy, errors, `${path}.scoringStrategy`);
        }
        return;
    }

    if (strategyType === 'rubric_matrix') {
        const dimensions = content.dimensions;
        const hasDimensions = hasArray(dimensions);
        if (!hasDimensions && !hasSegments) {
            errors.push(`${path} 需要至少 1 个 dimensions 或 segments`);
        }
    }
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
        if (typeof strategyType === 'string') {
            validateContentByStrategy(data.content, strategyType, errors, 'content', true);
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
