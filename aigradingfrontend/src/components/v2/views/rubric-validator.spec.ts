// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { RubricJSONV3 } from '@/types/rubric-v3';
import { validateRubricDraft } from './rubric-validator';

function baseRubric(): RubricJSONV3 {
    return {
        version: '3.0',
        metadata: {
            questionId: '15',
            title: '历史材料分析',
            subject: '历史',
            questionType: '材料题'
        },
        strategyType: 'point_accumulation',
        content: {
            scoringStrategy: {
                type: 'weighted',
                allowAlternative: true,
                strictMode: false
            },
            points: [
                {
                    id: '15-1',
                    questionSegment: '措施',
                    content: '推动科技与产业融合',
                    keywords: ['科技', '融合'],
                    requiredKeywords: ['融合'],
                    score: 2
                }
            ],
            totalScore: 2
        },
        constraints: [
            {
                id: 'c1',
                type: '阅卷提示',
                description: '按关键词命中给分'
            }
        ],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    };
}

describe('rubric-validator', () => {
    it('returns no blocking errors for a valid draft', () => {
        const result = validateRubricDraft(baseRubric());

        expect(result.errors).toEqual([]);
        expect(result.scoreSummary.itemCount).toBe(1);
        expect(result.missingFields.missingKeywordsItemIds).toHaveLength(0);
    });

    it('reports blocking score errors for non-pick_n rubric items', () => {
        const rubric = baseRubric();
        rubric.content.points[0].score = 0;

        const result = validateRubricDraft(rubric);

        expect(result.errors).toContain('存在分值小于等于 0 的评分条目');
        expect(result.scoreSummary.invalidScoreItemIds).toContain('15-1');
    });

    it('checks pick_n configuration and warns for missing semantic fields', () => {
        const rubric = baseRubric();
        rubric.content.scoringStrategy.type = 'pick_n';
        rubric.content.scoringStrategy.maxPoints = 0;
        rubric.content.scoringStrategy.pointValue = 0;
        rubric.content.points[0].keywords = [];
        rubric.content.points[0].requiredKeywords = [];
        rubric.content.points[0].questionSegment = '';
        rubric.constraints = [];

        const result = validateRubricDraft(rubric);

        expect(result.errors).toContain('pick_n 策略必须设置大于 0 的 maxPoints');
        expect(result.errors).toContain('pick_n 策略必须设置大于 0 的 pointValue');
        expect(result.warnings.some((warning) => warning.includes('缺少关键词'))).toBe(true);
        expect(result.warnings.some((warning) => warning.includes('缺少题干片段'))).toBe(true);
        expect(result.warnings.some((warning) => warning.includes('尚未设置阅卷约束'))).toBe(true);
    });
});
