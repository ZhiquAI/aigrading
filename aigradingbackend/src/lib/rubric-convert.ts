import { RubricJSONV3, validateRubricV3 } from './rubric-v3';

export class RubricSchemaError extends Error {
    public readonly errors: string[];

    constructor(errors: string[]) {
        super(`Rubric v3 校验失败: ${errors.join(', ')}`);
        this.name = 'RubricSchemaError';
        this.errors = errors;
    }
}

export function isRubricV3(data: unknown): data is RubricJSONV3 {
    if (!data || typeof data !== 'object') return false;
    return (data as { version?: string }).version === '3.0';
}

export function parseRubricV3(data: unknown): RubricJSONV3 {
    const validation = validateRubricV3(data);
    if (!validation.valid || !validation.rubric) {
        throw new RubricSchemaError(validation.errors);
    }
    return validation.rubric;
}
