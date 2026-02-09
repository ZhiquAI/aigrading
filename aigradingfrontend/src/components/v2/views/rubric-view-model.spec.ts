// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { RubricJSONV3 } from '@/types/rubric-v3';
import {
    applyEditableItems,
    buildRubricOverview,
    toEditableItems,
    getRubricTotalScore
} from './rubric-view-model';

function pointRubric(): RubricJSONV3 {
    return {
        version: '3.0',
        metadata: {
            questionId: '13',
            title: '建言献策',
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
                    id: '13-1',
                    questionSegment: '措施',
                    content: '加强科技投入',
                    keywords: ['投入', '科技创新'],
                    requiredKeywords: ['投入'],
                    score: 2
                }
            ],
            totalScore: 2
        },
        constraints: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    };
}

function matrixRubric(): RubricJSONV3 {
    return {
        version: '3.0',
        metadata: {
            questionId: '14',
            title: '观点论述',
            subject: '历史',
            questionType: '论述题'
        },
        strategyType: 'rubric_matrix',
        content: {
            dimensions: [
                {
                    id: 'dim-1',
                    name: '观点明确',
                    weight: 3,
                    levels: [
                        { label: 'A', score: 3, description: '观点明确且史论结合' },
                        { label: 'B', score: 2, description: '观点基本明确' }
                    ]
                }
            ],
            totalScore: 3
        },
        constraints: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    };
}

describe('rubric-view-model', () => {
    it('maps point_accumulation rubric into editable items with full semantic fields', () => {
        const editable = toEditableItems(pointRubric());

        expect(editable).toHaveLength(1);
        expect(editable[0]).toMatchObject({
            id: '13-1',
            questionSegment: '措施',
            content: '加强科技投入',
            keywords: ['投入', '科技创新'],
            requiredKeywords: ['投入'],
            score: 2
        });
    });

    it('preserves matrix levels when applying item changes', () => {
        const rubric = matrixRubric();
        const editable = toEditableItems(rubric);

        const next = applyEditableItems(
            rubric,
            editable.map((item) => ({ ...item, score: 4 }))
        );

        expect(next.strategyType).toBe('rubric_matrix');
        expect(next.content.dimensions[0].levels).toHaveLength(2);
        expect(next.content.dimensions[0].levels[0].label).toBe('A');
        expect(next.content.dimensions[0].weight).toBe(4);
    });

    it('builds compact overview counts for missing fields', () => {
        const rubric = pointRubric();
        rubric.content.points.push({
            id: '13-2',
            questionSegment: '',
            content: '',
            keywords: [],
            requiredKeywords: [],
            score: 1
        });

        const overview = buildRubricOverview(rubric);

        expect(getRubricTotalScore(rubric)).toBe(2);
        expect(overview.itemCount).toBe(2);
        expect(overview.missingKeywordsCount).toBe(1);
        expect(overview.missingContentCount).toBe(1);
        expect(overview.riskCount).toBeGreaterThanOrEqual(2);
    });
});
