import { RubricJSONV3, StrategyType } from './rubric-v3';
import { JudgeResult } from './rubric-judge';

export interface ScoreBreakdownItem {
    label: string;
    score: number;
    max: number;
    comment?: string;
    isNegative?: boolean;
}

export interface ScoreResult {
    score: number;
    maxScore: number;
    breakdown: ScoreBreakdownItem[];
    confidence: number;
    needsReview: boolean;
}

export interface ScoreRubricOptions {
    enableConstraintDsl?: boolean;
    segmentScorePolicy?: 'segments_first' | 'checkpoints_first';
    markNeedsReviewOnSegmentConflict?: boolean;
}

type SegmentAggregation = 'sum' | 'weighted_sum' | 'max';

interface NormalizedSegment {
    id: string;
    title?: string;
    strategyType: StrategyType;
    content: Record<string, unknown>;
    maxScore?: number;
    weight?: number;
    order?: number;
}

interface SegmentJudgeOverride {
    score?: number;
    max?: number;
    evidence?: string;
}

interface CompositeScoringOptions {
    segmentScorePolicy: 'segments_first' | 'checkpoints_first';
    markNeedsReviewOnSegmentConflict: boolean;
}

function sumScores(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0);
}

function ensureNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        : [];
}

function roundScore(value: number): number {
    return Math.round(value * 100) / 100;
}

function normalizeAggregation(value: unknown): SegmentAggregation {
    if (value === 'weighted_sum' || value === 'max' || value === 'sum') return value;
    return 'sum';
}

function normalizeSegmentScorePolicy(value: unknown): 'segments_first' | 'checkpoints_first' {
    return value === 'checkpoints_first' ? 'checkpoints_first' : 'segments_first';
}

function isStrategyType(value: unknown): value is StrategyType {
    return value === 'point_accumulation' || value === 'sequential_logic' || value === 'rubric_matrix';
}

function normalizeSegments(content: Record<string, unknown>): NormalizedSegment[] {
    const segments = asRecordArray(content.segments)
        .map((segment, index) => {
            const strategyType = segment.strategyType;
            const segmentContent = asRecord(segment.content);
            if (!isStrategyType(strategyType) || !segmentContent) return null;
            const idRaw = String(segment.id || '').trim();
            const id = idRaw || `segment_${index + 1}`;
            const title = typeof segment.title === 'string' ? segment.title.trim() : undefined;
            const maxScore = segment.maxScore !== undefined ? ensureNumber(segment.maxScore, 0) : undefined;
            const weight = segment.weight !== undefined ? ensureNumber(segment.weight, 0) : undefined;
            const order = segment.order !== undefined ? Math.floor(ensureNumber(segment.order, index)) : undefined;
            return {
                id,
                title: title || undefined,
                strategyType,
                content: segmentContent,
                maxScore: maxScore !== undefined && maxScore >= 0 ? maxScore : undefined,
                weight: weight !== undefined && weight > 0 ? weight : undefined,
                order
            } as NormalizedSegment;
        })
        .filter((segment): segment is NormalizedSegment => !!segment);

    return segments
        .map((segment, index) => ({ segment, index }))
        .sort((a, b) => {
            if (a.segment.order !== undefined && b.segment.order !== undefined) {
                if (a.segment.order !== b.segment.order) return a.segment.order - b.segment.order;
            } else if (a.segment.order !== undefined) {
                return -1;
            } else if (b.segment.order !== undefined) {
                return 1;
            }
            return a.index - b.index;
        })
        .map((item) => item.segment);
}

function computeRawMaxScore(strategyType: StrategyType, content: Record<string, unknown>): number {
    const totalScore = ensureNumber(content.totalScore, Number.NaN);
    if (Number.isFinite(totalScore) && totalScore >= 0) {
        return totalScore;
    }

    if (strategyType === 'rubric_matrix') {
        const dimensions = asRecordArray(content.dimensions);
        return sumScores(dimensions.map((dimension) => ensureNumber(dimension.weight, 0)));
    }

    if (strategyType === 'sequential_logic') {
        const steps = asRecordArray(content.steps);
        return sumScores(steps.map((point) => ensureNumber(point.score, 0)));
    }

    const points = asRecordArray(content.points);
    return sumScores(points.map((point) => ensureNumber(point.score, 0)));
}

function computeSegmentConfiguredMax(segment: NormalizedSegment): number {
    if (segment.maxScore !== undefined) {
        return Math.max(0, segment.maxScore);
    }
    return Math.max(0, computeRawMaxScore(segment.strategyType, segment.content));
}

function computeCompositeMaxScore(content: Record<string, unknown>): number {
    const explicitTotal = ensureNumber(content.totalScore, Number.NaN);
    if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
        return explicitTotal;
    }

    const segments = normalizeSegments(content);
    if (segments.length === 0) {
        return 0;
    }

    const aggregation = normalizeAggregation(content.aggregation);
    if (aggregation === 'max') {
        return Math.max(...segments.map((segment) => computeSegmentConfiguredMax(segment)));
    }
    if (aggregation === 'weighted_sum') {
        return sumScores(
            segments.map((segment) => {
                const max = computeSegmentConfiguredMax(segment);
                return segment.weight !== undefined ? segment.weight : max;
            })
        );
    }

    return sumScores(segments.map((segment) => computeSegmentConfiguredMax(segment)));
}

function computeMaxScore(rubric: RubricJSONV3): number {
    const content = asRecord(rubric.content) || {};
    const segments = normalizeSegments(content);
    if (segments.length > 0) {
        return computeCompositeMaxScore(content);
    }
    return computeRawMaxScore(rubric.strategyType, content);
}

function applyConstraintDsl(
    score: number,
    rubric: RubricJSONV3,
    judge: JudgeResult,
    breakdown: ScoreBreakdownItem[]
): { score: number; needsReviewByConstraint: boolean } {
    const constraints = rubric.constraints || [];
    if (constraints.length === 0) {
        return { score, needsReviewByConstraint: false };
    }

    let currentScore = score;
    let needsReviewByConstraint = false;

    for (const constraint of constraints) {
        const check = judge.constraintChecks?.[constraint.id];
        const config = asRecord(constraint.config);

        if (constraint.type === 'deduction_fixed') {
            if (!check) {
                needsReviewByConstraint = true;
                breakdown.push({
                    label: `约束 ${constraint.id}`,
                    score: 0,
                    max: 0,
                    comment: '缺少约束判定，未执行扣分'
                });
                continue;
            }
            if (check.triggered) {
                const points = Math.max(0, ensureNumber(config?.points, 0));
                currentScore -= points;
                breakdown.push({
                    label: `约束 ${constraint.id}`,
                    score: -points,
                    max: 0,
                    isNegative: true,
                    comment: check.evidence || constraint.description || '命中固定扣分规则'
                });
            }
            continue;
        }

        if (constraint.type === 'deduction_per_count') {
            if (!check) {
                needsReviewByConstraint = true;
                breakdown.push({
                    label: `约束 ${constraint.id}`,
                    score: 0,
                    max: 0,
                    comment: '缺少约束判定，未执行计数扣分'
                });
                continue;
            }
            if (check.triggered) {
                const points = Math.max(0, ensureNumber(config?.points, 0));
                const perCount = Math.max(1, Math.floor(ensureNumber(config?.perCount, 1)));
                const observedCount = Math.max(0, Math.floor(ensureNumber(check.observedCount, 0)));
                const maxDeduct = Math.max(0, ensureNumber(config?.maxDeduct, Number.POSITIVE_INFINITY));
                const steps = Math.floor(observedCount / perCount);
                const deduct = Math.min(maxDeduct, steps * points);

                currentScore -= deduct;
                breakdown.push({
                    label: `约束 ${constraint.id}`,
                    score: -deduct,
                    max: 0,
                    isNegative: true,
                    comment: check.evidence || `计数扣分: ${observedCount}/${perCount}, 扣 ${deduct} 分`
                });
            }
            continue;
        }

        if (constraint.type === 'score_cap') {
            if (check?.triggered) {
                const cap = Math.max(0, ensureNumber(config?.maxScore, currentScore));
                const cappedScore = Math.min(currentScore, cap);
                if (cappedScore < currentScore) {
                    breakdown.push({
                        label: `约束 ${constraint.id}`,
                        score: cappedScore - currentScore,
                        max: 0,
                        isNegative: true,
                        comment: check.evidence || `触发封顶，最高 ${cap} 分`
                    });
                }
                currentScore = cappedScore;
            }
            continue;
        }

        if (constraint.type === 'logic_check') {
            if (!check || !check.triggered) {
                needsReviewByConstraint = true;
                breakdown.push({
                    label: `约束 ${constraint.id}`,
                    score: 0,
                    max: 0,
                    comment: check?.evidence || '逻辑校验未通过，建议人工复核'
                });
            }
            continue;
        }

        breakdown.push({
            label: `约束 ${constraint.id}`,
            score: 0,
            max: 0,
            comment: `未知约束类型已忽略: ${constraint.type}`
        });
    }

    return { score: Math.max(0, currentScore), needsReviewByConstraint };
}

function scoreAtomicRubric(rubric: RubricJSONV3, judge: JudgeResult): ScoreResult {
    const breakdown: ScoreBreakdownItem[] = [];
    const confidence = Number(judge.confidence) || 0.7;
    let needsReview = !!judge.needsReview || confidence < 0.8;
    const content = asRecord(rubric.content) || {};

    if (rubric.strategyType === 'rubric_matrix') {
        const dimensions = asRecordArray(content.dimensions);
        let total = 0;

        dimensions.forEach((dimension) => {
            const dimensionId = String(dimension.id || '');
            const dimensionName = String(dimension.name || dimensionId || '维度');
            const levels = asRecordArray(dimension.levels);
            const judged = judge.dimensions?.[dimensionId];
            let awarded = 0;

            if (judged?.score !== undefined) {
                awarded = ensureNumber(judged.score, 0);
            } else if (judged?.level) {
                const matchedLevel = levels.find((level) => String(level.label || '') === judged.level);
                awarded = matchedLevel ? ensureNumber(matchedLevel.score, 0) : 0;
            }

            total += awarded;
            const levelMax = levels.length > 0
                ? Math.max(...levels.map((level) => ensureNumber(level.score, 0)))
                : Math.max(0, ensureNumber(dimension.weight, 0));

            breakdown.push({
                label: `${dimensionName}(${judged?.level || '未判定'})`,
                score: awarded,
                max: levelMax,
                comment: judged?.evidence
            });
        });

        return {
            score: Math.max(0, total),
            maxScore: computeRawMaxScore(rubric.strategyType, content),
            breakdown,
            confidence,
            needsReview
        };
    }

    const scoringStrategy = asRecord(content.scoringStrategy) || {};
    const scoringType = String(scoringStrategy.type || 'weighted');
    const items = rubric.strategyType === 'sequential_logic'
        ? asRecordArray(content.steps)
        : asRecordArray(content.points);

    const metItems = items.filter((item) => {
        const itemId = String(item.id || '');
        return !!judge.checkpoints?.[itemId]?.met;
    });

    const allMet = items.length > 0 && metItems.length === items.length;
    const maxPickPoints = Math.max(1, Math.floor(ensureNumber(scoringStrategy.maxPoints, items.length || 1)));
    const pickPointValue = scoringStrategy.pointValue !== undefined
        ? ensureNumber(scoringStrategy.pointValue, Number.NaN)
        : Number.NaN;

    const selectedPickIds = new Set(
        (scoringType === 'pick_n' ? metItems.slice(0, maxPickPoints) : []).map((item) => String(item.id || ''))
    );

    let score = 0;
    if (scoringType === 'all') {
        score = allMet ? computeRawMaxScore(rubric.strategyType, content) : 0;
    } else if (scoringType === 'pick_n') {
        if (Number.isFinite(pickPointValue)) {
            score = pickPointValue * selectedPickIds.size;
        } else {
            score = sumScores(
                items
                    .filter((item) => selectedPickIds.has(String(item.id || '')))
                    .map((item) => ensureNumber(item.score, 0))
            );
        }
    } else {
        score = sumScores(metItems.map((item) => ensureNumber(item.score, 0)));
    }

    items.forEach((item) => {
        const itemId = String(item.id || '');
        const contentText = String(item.content || '').trim();
        const judged = judge.checkpoints?.[itemId];
        const pointScore = ensureNumber(item.score, 0);
        const pointMax = scoringType === 'pick_n' && Number.isFinite(pickPointValue) ? pickPointValue : pointScore;

        let awarded = 0;
        let comment = '✗ 未命中';

        if (judged?.met) {
            if (scoringType === 'all') {
                awarded = allMet ? pointScore : 0;
                comment = allMet
                    ? judged.evidence || '✓ 命中'
                    : judged.evidence || '✓ 命中（全点模式未全部满足，不计分）';
            } else if (scoringType === 'pick_n') {
                if (selectedPickIds.has(itemId)) {
                    awarded = Number.isFinite(pickPointValue) ? pickPointValue : pointScore;
                    comment = judged.evidence || '✓ 命中';
                } else {
                    awarded = 0;
                    comment = judged.evidence || '✓ 命中（超出 N，不计分）';
                }
            } else {
                awarded = pointScore;
                comment = judged.evidence || '✓ 命中';
            }
        }

        breakdown.push({
            label: `${itemId} ${contentText}`.trim(),
            score: awarded,
            max: pointMax,
            comment
        });
    });

    return {
        score: Math.max(0, score),
        maxScore: computeRawMaxScore(rubric.strategyType, content),
        breakdown,
        confidence,
        needsReview
    };
}

function scoreCompositeRubric(rubric: RubricJSONV3, judge: JudgeResult, options: CompositeScoringOptions): ScoreResult {
    const content = asRecord(rubric.content) || {};
    const segments = normalizeSegments(content);
    const aggregation = normalizeAggregation(content.aggregation);
    const confidenceBase = Number(judge.confidence) || 0.7;

    if (segments.length === 0) {
        return scoreAtomicRubric(rubric, judge);
    }

    const breakdown: ScoreBreakdownItem[] = [];
    const segmentScores: Array<{ score: number; max: number; weight: number; result: ScoreResult; id: string; title: string }> = [];
    let needsReview = !!judge.needsReview || confidenceBase < 0.8;

    segments.forEach((segment, index) => {
        const segmentRubric: RubricJSONV3 = {
            version: rubric.version,
            metadata: {
                ...rubric.metadata,
                questionId: `${rubric.metadata.questionId || 'q'}#${segment.id}`,
                title: segment.title || rubric.metadata.title
            },
            strategyType: segment.strategyType,
            content: segment.content as RubricJSONV3['content'],
            constraints: [],
            createdAt: rubric.createdAt,
            updatedAt: rubric.updatedAt
        };

        const segmentResult = scoreAtomicRubric(segmentRubric, judge);
        const segmentJudge = judge.segments?.[segment.id] as SegmentJudgeOverride | undefined;
        const segmentJudgeScore = ensureNumber(segmentJudge?.score, Number.NaN);
        const segmentJudgeMax = ensureNumber(segmentJudge?.max, Number.NaN);

        const configuredMax = computeSegmentConfiguredMax(segment);
        const fallbackMax = Math.max(0, segmentResult.maxScore);
        const resolvedMax = configuredMax > 0
            ? configuredMax
            : (Number.isFinite(segmentJudgeMax) && segmentJudgeMax >= 0 ? segmentJudgeMax : fallbackMax);
        const atomicSegmentScore = segmentResult.score;
        const hasSegmentJudgeScore = Number.isFinite(segmentJudgeScore);
        const hasConflict = hasSegmentJudgeScore && Math.abs(segmentJudgeScore - atomicSegmentScore) > 0.01;
        const preferredRawScore = hasSegmentJudgeScore
            ? (options.segmentScorePolicy === 'checkpoints_first' ? atomicSegmentScore : segmentJudgeScore)
            : atomicSegmentScore;

        if (hasConflict && options.markNeedsReviewOnSegmentConflict) {
            needsReview = true;
        }

        const rawSegmentScore = preferredRawScore;
        const resolvedScore = Math.max(0, Math.min(rawSegmentScore, resolvedMax > 0 ? resolvedMax : rawSegmentScore));
        const resolvedWeight = segment.weight !== undefined
            ? segment.weight
            : (resolvedMax > 0 ? resolvedMax : 1);
        const scoreSource = !hasSegmentJudgeScore
            ? '条目判定'
            : (hasConflict
                ? (options.segmentScorePolicy === 'checkpoints_first' ? '冲突:采用条目判定' : '冲突:采用段级判定')
                : '段级判定');

        const segmentTitle = segment.title || `第${index + 1}段`;
        breakdown.push({
            label: `${segmentTitle}`,
            score: resolvedScore,
            max: resolvedMax,
            comment: `${scoreSource} · 策略: ${segment.strategyType}${segmentJudge?.evidence ? ` · ${segmentJudge.evidence}` : ''}`
        });

        if (hasConflict) {
            breakdown.push({
                label: `  · 冲突提示 ${segmentTitle}`,
                score: 0,
                max: 0,
                comment: `段级分 ${roundScore(segmentJudgeScore)} 与条目分 ${roundScore(atomicSegmentScore)} 不一致，策略: ${options.segmentScorePolicy}`
            });
        }

        segmentResult.breakdown.forEach((item) => {
            breakdown.push({
                ...item,
                label: `  · ${item.label}`
            });
        });

        segmentScores.push({
            id: segment.id,
            title: segmentTitle,
            score: resolvedScore,
            max: resolvedMax,
            weight: resolvedWeight,
            result: segmentResult
        });

        needsReview = needsReview || segmentResult.needsReview;
    });

    let score = 0;
    let maxScore = 0;

    if (aggregation === 'max') {
        score = Math.max(...segmentScores.map((item) => item.score));
        maxScore = Math.max(...segmentScores.map((item) => item.max));
    } else if (aggregation === 'weighted_sum') {
        score = sumScores(
            segmentScores.map((item) => {
                if (item.max <= 0) return 0;
                return (item.score / item.max) * item.weight;
            })
        );
        maxScore = sumScores(segmentScores.map((item) => item.weight));
    } else {
        score = sumScores(segmentScores.map((item) => item.score));
        maxScore = sumScores(segmentScores.map((item) => item.max));
    }

    const explicitTotal = ensureNumber(content.totalScore, Number.NaN);
    if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
        maxScore = explicitTotal;
        score = Math.min(score, maxScore);
    }

    const confidence = segmentScores.length > 0
        ? sumScores(segmentScores.map((item) => item.result.confidence)) / segmentScores.length
        : confidenceBase;

    return {
        score: Math.max(0, score),
        maxScore: Math.max(0, maxScore),
        breakdown,
        confidence,
        needsReview
    };
}

export function scoreRubric(
    rubric: RubricJSONV3,
    judge: JudgeResult,
    options: ScoreRubricOptions = {}
): ScoreResult {
    const enableConstraintDsl = options.enableConstraintDsl !== false;
    const segmentScorePolicy = normalizeSegmentScorePolicy(options.segmentScorePolicy);
    const markNeedsReviewOnSegmentConflict = options.markNeedsReviewOnSegmentConflict !== false;
    const content = asRecord(rubric.content) || {};
    const hasSegments = normalizeSegments(content).length > 0;

    let result = hasSegments
        ? scoreCompositeRubric(rubric, judge, {
            segmentScorePolicy,
            markNeedsReviewOnSegmentConflict
        })
        : scoreAtomicRubric(rubric, judge);

    if (enableConstraintDsl) {
        const constrained = applyConstraintDsl(result.score, rubric, judge, result.breakdown);
        result = {
            ...result,
            score: constrained.score,
            needsReview: result.needsReview || constrained.needsReviewByConstraint
        };
    }

    const computedMax = result.maxScore > 0 ? result.maxScore : computeMaxScore(rubric);
    const normalizedMax = Math.max(0, computedMax);
    const normalizedScore = Math.max(0, normalizedMax > 0 ? Math.min(result.score, normalizedMax) : result.score);

    return {
        ...result,
        score: roundScore(normalizedScore),
        maxScore: roundScore(normalizedMax)
    };
}
