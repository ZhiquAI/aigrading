import { RubricJSONV3 } from './rubric-v3';
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

function sumScores(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0);
}

function computeMaxScore(rubric: RubricJSONV3): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = rubric.content as any;
    if (rubric.strategyType === 'rubric_matrix') {
        if (content.totalScore) return content.totalScore;
        return sumScores((content.dimensions || []).map((d: any) => d.weight || 0));
    }
    if (rubric.strategyType === 'sequential_logic') {
        if (content.totalScore) return content.totalScore;
        return sumScores((content.steps || []).map((p: any) => p.score));
    }
    if (content.totalScore) return content.totalScore;
    return sumScores((content.points || []).map((p: any) => p.score));
}

export function scoreRubric(rubric: RubricJSONV3, judge: JudgeResult): ScoreResult {
    const breakdown: ScoreBreakdownItem[] = [];
    const confidence = Number(judge.confidence) || 0.7;
    const needsReview = !!judge.needsReview || confidence < 0.8;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = rubric.content as any;

    if (rubric.strategyType === 'rubric_matrix') {
        let total = 0;
        (content.dimensions || []).forEach((dim: any) => {
            const judged = judge.dimensions?.[dim.id];
            let awarded = 0;
            if (judged?.score !== undefined) {
                awarded = Number(judged.score) || 0;
            } else if (judged?.level) {
                const level = dim.levels.find((l: any) => l.label === judged.level);
                awarded = level ? level.score : 0;
            }
            total += awarded;
            breakdown.push({
                label: `${dim.name}(${judged?.level || '未判定'})`,
                score: awarded,
                max: Math.max(...dim.levels.map((l: any) => l.score)),
                comment: judged?.evidence
            });
        });
        return {
            score: total,
            maxScore: computeMaxScore(rubric),
            breakdown,
            confidence,
            needsReview
        };
    }

    const scoring = content.scoringStrategy;

    const points = rubric.strategyType === 'sequential_logic'
        ? content.steps || []
        : content.points || [];

    const metPoints = points.filter((p: any) => judge.checkpoints?.[p.id]?.met);

    let score = 0;
    if (scoring.type === 'all') {
        score = metPoints.length === points.length ? computeMaxScore(rubric) : 0;
    } else if (scoring.type === 'pick_n') {
        const maxPoints = scoring.maxPoints || points.length;
        const baseScore = scoring.pointValue;
        const selected = metPoints.slice(0, maxPoints);
        if (baseScore !== undefined) {
            score = baseScore * selected.length;
        } else {
            score = sumScores(selected.map((p: any) => p.score));
        }
    } else {
        score = sumScores(metPoints.map((p: any) => p.score));
    }

    points.forEach((p: any) => {
        const judged = judge.checkpoints?.[p.id];
        breakdown.push({
            label: `${p.id} ${p.content}`,
            score: judged?.met ? (scoring.type === 'pick_n' && scoring.pointValue ? scoring.pointValue : p.score) : 0,
            max: scoring.type === 'pick_n' && scoring.pointValue ? scoring.pointValue : p.score,
            comment: judged?.met ? judged?.evidence || '✓ 命中' : '✗ 未命中'
        });
    });

    return {
        score,
        maxScore: computeMaxScore(rubric),
        breakdown,
        confidence,
        needsReview
    };
}
