import assert from 'node:assert/strict';
import { scoreRubric } from '../src/lib/score-engine';
import type { RubricJSONV3 } from '../src/lib/rubric-v3';
import type { JudgeResult } from '../src/lib/rubric-judge';

function nowIso(): string {
    return new Date().toISOString();
}

function buildCompositeRubric(aggregation: 'sum' | 'weighted_sum' | 'max', withWeights = false): RubricJSONV3 {
    const now = nowIso();
    return {
        version: '3.0',
        metadata: {
            questionId: '13',
            title: '综合题',
            subject: '历史',
            questionType: '综合题'
        },
        strategyType: 'point_accumulation',
        content: {
            aggregation,
            segments: [
                {
                    id: 'seg_fill',
                    title: '人物与史实对应',
                    strategyType: 'point_accumulation',
                    weight: withWeights ? 4 : undefined,
                    content: {
                        scoringStrategy: {
                            type: 'weighted',
                            strictMode: true,
                            allowAlternative: false,
                            openEnded: false
                        },
                        points: [
                            { id: 's1_p1', content: '伯里克利', score: 2 },
                            { id: 's1_p2', content: '罗马民法大全', score: 2 }
                        ],
                        totalScore: 4
                    }
                },
                {
                    id: 'seg_open',
                    title: '意义分析',
                    strategyType: 'point_accumulation',
                    weight: withWeights ? 6 : undefined,
                    content: {
                        scoringStrategy: {
                            type: 'pick_n',
                            maxPoints: 1,
                            pointValue: 2,
                            strictMode: false,
                            allowAlternative: true,
                            openEnded: true
                        },
                        points: [
                            { id: 's2_p1', content: '促进思想解放', score: 0, openEnded: true },
                            { id: 's2_p2', content: '推动思想繁荣', score: 0, openEnded: true }
                        ],
                        totalScore: 2
                    }
                }
            ]
        },
        createdAt: now,
        updatedAt: now
    } as RubricJSONV3;
}

function buildJudge(overrides?: Partial<JudgeResult>): JudgeResult {
    return {
        confidence: 0.95,
        needsReview: false,
        checkpoints: {
            s1_p1: { met: true, evidence: '命中填空1' },
            s1_p2: { met: false, evidence: '未命中填空2' },
            s2_p1: { met: true, evidence: '命中意义点1' },
            s2_p2: { met: true, evidence: '命中意义点2' }
        },
        ...overrides
    };
}

function run(): void {
    // 1) sum 聚合：2 + 2 = 4 / 6
    {
        const rubric = buildCompositeRubric('sum');
        const judge = buildJudge();
        const result = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        assert.equal(result.score, 4);
        assert.equal(result.maxScore, 6);
    }

    // 2) weighted_sum 聚合：2/4*4 + 2/2*6 = 8 / 10
    {
        const rubric = buildCompositeRubric('weighted_sum', true);
        const judge = buildJudge();
        const result = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        assert.equal(result.score, 8);
        assert.equal(result.maxScore, 10);
    }

    // 3) max 聚合：max(2,2) = 2 / max(4,2)=4
    {
        const rubric = buildCompositeRubric('max');
        const judge = buildJudge();
        const result = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        assert.equal(result.score, 2);
        assert.equal(result.maxScore, 4);
    }

    // 4) 冲突时默认段级优先，并触发 needsReview
    {
        const rubric = buildCompositeRubric('sum');
        const judge = buildJudge({
            checkpoints: {
                s1_p1: { met: false },
                s1_p2: { met: false },
                s2_p1: { met: false },
                s2_p2: { met: false }
            },
            segments: {
                seg_open: { score: 2, max: 2, evidence: '任答一点可得满分' }
            }
        });
        const result = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        assert.equal(result.score, 2);
        assert.equal(result.needsReview, true);
        assert.ok(result.breakdown.some((item) => item.label.includes('意义分析') && item.score === 2));
        assert.ok(result.breakdown.some((item) => item.label.includes('冲突提示')));
    }

    // 5) 冲突时可切换为条目优先
    {
        const rubric = buildCompositeRubric('sum');
        const judge = buildJudge({
            checkpoints: {
                s1_p1: { met: false },
                s1_p2: { met: false },
                s2_p1: { met: false },
                s2_p2: { met: false }
            },
            segments: {
                seg_open: { score: 2, max: 2, evidence: '任答一点可得满分' }
            }
        });
        const result = scoreRubric(rubric, judge, {
            enableConstraintDsl: false,
            segmentScorePolicy: 'checkpoints_first'
        });
        assert.equal(result.score, 0);
        assert.equal(result.needsReview, true);
    }

    // 6) 可关闭冲突即复核标记
    {
        const rubric = buildCompositeRubric('sum');
        const judge = buildJudge({
            checkpoints: {
                s1_p1: { met: false },
                s1_p2: { met: false },
                s2_p1: { met: false },
                s2_p2: { met: false }
            },
            segments: {
                seg_open: { score: 2, max: 2, evidence: '任答一点可得满分' }
            }
        });
        const result = scoreRubric(rubric, judge, {
            enableConstraintDsl: false,
            markNeedsReviewOnSegmentConflict: false
        });
        assert.equal(result.score, 2);
        assert.equal(result.needsReview, false);
    }

    console.log('contract-score-engine-segments: all scenarios passed');
}

run();
