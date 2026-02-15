import assert from 'node:assert/strict';
import { scoreRubric } from '../src/lib/score-engine';
import type { RubricJSONV3 } from '../src/lib/rubric-v3';
import type { JudgeResult } from '../src/lib/rubric-judge';

function buildBaseRubric(constraints?: RubricJSONV3['constraints']): RubricJSONV3 {
    const now = new Date().toISOString();
    return {
        version: '3.0',
        metadata: {
            questionId: '13',
            title: '材料题',
            subject: '历史',
            questionType: '材料题'
        },
        strategyType: 'point_accumulation',
        content: {
            scoringStrategy: {
                type: 'weighted',
                strictMode: false,
                allowAlternative: true,
                openEnded: false
            },
            points: [
                { id: '13-1', content: '要点1', score: 5, keywords: ['A'] },
                { id: '13-2', content: '要点2', score: 5, keywords: ['B'] }
            ],
            totalScore: 10
        },
        constraints,
        createdAt: now,
        updatedAt: now
    };
}

function buildJudge(overrides?: Partial<JudgeResult>): JudgeResult {
    return {
        confidence: 0.92,
        needsReview: false,
        checkpoints: {
            '13-1': { met: true, evidence: '命中要点1' },
            '13-2': { met: true, evidence: '命中要点2' }
        },
        ...overrides
    };
}

function run(): void {
    // 1) 基线回归：无 constraints 时和旧逻辑一致
    {
        const rubric = buildBaseRubric();
        const judge = buildJudge();
        const legacy = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        const current = scoreRubric(rubric, judge, { enableConstraintDsl: true });
        assert.equal(legacy.score, 10);
        assert.equal(current.score, legacy.score);
        assert.equal(current.needsReview, false);
    }

    // 2) 固定扣分
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_fixed',
                type: 'deduction_fixed',
                description: '无标题扣2分',
                config: { points: 2, condition: 'missing_title' }
            }
        ]);
        const judge = buildJudge({
            constraintChecks: {
                c_fixed: { triggered: true, evidence: '未识别标题' }
            }
        });
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 8);
        assert.ok(result.breakdown.some((item) => item.label.includes('c_fixed') && item.score === -2));
    }

    // 3) 计数扣分 observedCount=7, perCount=3, points=1 => 扣2
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_per',
                type: 'deduction_per_count',
                description: '每3个错别字扣1分',
                config: { points: 1, perCount: 3, metric: 'typo_count' }
            }
        ]);
        const judge = buildJudge({
            constraintChecks: {
                c_per: { triggered: true, observedCount: 7, evidence: '检测到7处错字' }
            }
        });
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 8);
    }

    // 4) 分数封顶
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_cap',
                type: 'score_cap',
                description: '字数不足300不及格（最高30分）',
                config: { maxScore: 6, condition: 'min_word_count', threshold: 300 }
            }
        ]);
        const judge = buildJudge({
            constraintChecks: {
                c_cap: { triggered: true, evidence: '字数不足' }
            }
        });
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 6);
    }

    // 5) 逻辑校验失败 -> needsReview=true
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_logic',
                type: 'logic_check',
                description: '出现瓦特必须包含蒸汽机',
                config: { rule: 'if watt then steam_engine' }
            }
        ]);
        const judge = buildJudge({
            constraintChecks: {
                c_logic: { triggered: false, evidence: '提到瓦特未提到蒸汽机' }
            }
        });
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 10);
        assert.equal(result.needsReview, true);
    }

    // 6) 降级兼容：缺少 deduction check 不扣分但 needsReview=true
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_missing',
                type: 'deduction_fixed',
                description: '无标题扣2分',
                config: { points: 2, condition: 'missing_title' }
            }
        ]);
        const judge = buildJudge({ constraintChecks: undefined });
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 10);
        assert.equal(result.needsReview, true);
    }

    // 7) 灰度关闭时约束不生效
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_off',
                type: 'deduction_fixed',
                description: '无标题扣2分',
                config: { points: 2, condition: 'missing_title' }
            }
        ]);
        const judge = buildJudge({
            constraintChecks: {
                c_off: { triggered: true, evidence: '未识别标题' }
            }
        });
        const result = scoreRubric(rubric, judge, { enableConstraintDsl: false });
        assert.equal(result.score, 10);
    }

    // 8) 未知约束不影响流程
    {
        const rubric = buildBaseRubric([
            {
                id: 'c_unknown',
                type: 'unknown_type',
                description: '未知类型',
                config: {}
            }
        ]);
        const judge = buildJudge();
        const result = scoreRubric(rubric, judge);
        assert.equal(result.score, 10);
        assert.ok(result.breakdown.some((item) => item.label.includes('c_unknown')));
    }

    console.log('contract-custom-rules: all scenarios passed');
}

run();
