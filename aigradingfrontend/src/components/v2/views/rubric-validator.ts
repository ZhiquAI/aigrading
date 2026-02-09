import type { RubricJSONV3 } from '@/types/rubric-v3';
import {
    getRubricTotalScore,
    getScoringStrategy,
    getItemCompleteness,
    toEditableItems
} from './rubric-view-model';

export interface RubricValidationSummary {
    calculatedTotal: number;
    declaredTotal?: number;
    itemCount: number;
    invalidScoreItemIds: string[];
}

export interface RubricValidationMissingFields {
    missingContentItemIds: string[];
    missingKeywordsItemIds: string[];
    missingQuestionSegmentItemIds: string[];
    missingRequiredKeywordsItemIds: string[];
    missingConstraintDescriptionIds: string[];
}

export interface RubricValidationResult {
    errors: string[];
    warnings: string[];
    scoreSummary: RubricValidationSummary;
    missingFields: RubricValidationMissingFields;
}

export interface RubricTemplateValidationResult {
    errors: string[];
    warnings: string[];
    baseValidation: RubricValidationResult;
}

function hasPositiveScore(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

export function validateRubricDraft(rubric: RubricJSONV3): RubricValidationResult {
    const items = toEditableItems(rubric);
    const scoringStrategy = getScoringStrategy(rubric);

    const errors: string[] = [];
    const warnings: string[] = [];

    const missingFields: RubricValidationMissingFields = {
        missingContentItemIds: [],
        missingKeywordsItemIds: [],
        missingQuestionSegmentItemIds: [],
        missingRequiredKeywordsItemIds: [],
        missingConstraintDescriptionIds: []
    };

    const invalidScoreItemIds: string[] = [];

    if (items.length === 0) {
        errors.push('至少需要一个评分条目');
    }

    items.forEach((item) => {
        const completeness = getItemCompleteness(item, rubric.strategyType);

        if (completeness.missingContent) {
            missingFields.missingContentItemIds.push(item.id);
        }
        if (completeness.missingKeywords) {
            missingFields.missingKeywordsItemIds.push(item.id);
        }
        if (completeness.missingQuestionSegment) {
            missingFields.missingQuestionSegmentItemIds.push(item.id);
        }
        if (completeness.missingRequiredKeywords) {
            missingFields.missingRequiredKeywordsItemIds.push(item.id);
        }

        const allowZeroScore = Boolean(scoringStrategy && scoringStrategy.type === 'pick_n');
        if (!allowZeroScore && !hasPositiveScore(item.score)) {
            invalidScoreItemIds.push(item.id);
        }
    });

    if (invalidScoreItemIds.length > 0) {
        errors.push('存在分值小于等于 0 的评分条目');
    }

    if (scoringStrategy?.type === 'pick_n') {
        if (!hasPositiveScore(Number(scoringStrategy.maxPoints))) {
            errors.push('pick_n 策略必须设置大于 0 的 maxPoints');
        }
        if (!hasPositiveScore(Number(scoringStrategy.pointValue))) {
            errors.push('pick_n 策略必须设置大于 0 的 pointValue');
        }
    }

    const declaredTotal = rubric.content.totalScore;
    const calculatedTotal = getRubricTotalScore(rubric);

    if (typeof declaredTotal === 'number' && rubric.strategyType !== 'rubric_matrix') {
        if (declaredTotal <= 0) {
            errors.push('总分必须大于 0');
        } else if (Math.abs(declaredTotal - calculatedTotal) > 0.0001) {
            warnings.push('总分与条目分值汇总不一致，保存时将按最新条目重新计算');
        }
    }

    const constraints = rubric.constraints || [];
    constraints.forEach((constraint) => {
        if (!constraint.description || constraint.description.trim().length === 0) {
            missingFields.missingConstraintDescriptionIds.push(constraint.id);
        }
    });

    if (missingFields.missingContentItemIds.length > 0) {
        warnings.push(`有 ${missingFields.missingContentItemIds.length} 条内容为空`);
    }
    if (missingFields.missingKeywordsItemIds.length > 0) {
        warnings.push(`有 ${missingFields.missingKeywordsItemIds.length} 条缺少关键词`);
    }
    if (missingFields.missingQuestionSegmentItemIds.length > 0) {
        warnings.push(`有 ${missingFields.missingQuestionSegmentItemIds.length} 条缺少题干片段`);
    }
    if (missingFields.missingRequiredKeywordsItemIds.length > 0) {
        warnings.push(`有 ${missingFields.missingRequiredKeywordsItemIds.length} 条缺少必选关键词`);
    }
    if (missingFields.missingConstraintDescriptionIds.length > 0) {
        warnings.push(`有 ${missingFields.missingConstraintDescriptionIds.length} 条约束缺少描述`);
    }

    if (constraints.length === 0) {
        warnings.push('尚未设置阅卷约束（constraints）');
    }

    return {
        errors,
        warnings,
        scoreSummary: {
            calculatedTotal,
            declaredTotal,
            itemCount: items.length,
            invalidScoreItemIds
        },
        missingFields
    };
}

export function validateRubricForTemplate(rubric: RubricJSONV3): RubricTemplateValidationResult {
    const baseValidation = validateRubricDraft(rubric);
    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];

    const { missingFields, scoreSummary } = baseValidation;
    const items = toEditableItems(rubric);
    const normalizedContents = items
        .map((item) => (item.content || '').trim().toLowerCase())
        .filter(Boolean);
    const duplicateCount = normalizedContents.length - new Set(normalizedContents).size;

    if (missingFields.missingContentItemIds.length > 0) {
        errors.push('存在空白评分条目，不能保存为模板');
    }
    if (missingFields.missingKeywordsItemIds.length > 0) {
        errors.push('存在缺少关键词的条目，不能保存为模板');
    }
    if (missingFields.missingRequiredKeywordsItemIds.length > 0) {
        errors.push('存在缺少必选关键词的条目，不能保存为模板');
    }
    if (missingFields.missingQuestionSegmentItemIds.length > 0) {
        errors.push('存在缺少题干片段的条目，不能保存为模板');
    }
    if (missingFields.missingConstraintDescriptionIds.length > 0) {
        errors.push('存在空描述约束，不能保存为模板');
    }
    if ((rubric.constraints || []).length === 0) {
        errors.push('请至少配置一条阅卷约束后再保存模板');
    }
    if (duplicateCount > 0) {
        errors.push('存在重复评分条目，请去重后再保存模板');
    }
    if (
        typeof scoreSummary.declaredTotal === 'number'
        && Math.abs(scoreSummary.declaredTotal - scoreSummary.calculatedTotal) > 0.0001
    ) {
        errors.push('总分与条目分值不一致，不能保存为模板');
    }

    return {
        errors: Array.from(new Set(errors)),
        warnings: Array.from(new Set(warnings)),
        baseValidation
    };
}
