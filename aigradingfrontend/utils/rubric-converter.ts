/**
 * rubric-converter.ts - 评分细则格式转换器（V3 only）
 */

import type { RubricJSONV3, RubricPoint } from '../types/rubric-v3';

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
}

function resolveSegmentRows(rubric: RubricJSONV3): Array<{ id: string; content: string; score: number }> {
    const content = asRecord(rubric.content) || {};
    const segments = asRecordArray(content.segments);
    if (segments.length === 0) return [];

    const rows: Array<{ id: string; content: string; score: number }> = [];
    segments.forEach((segment, index) => {
        const segmentId = String(segment.id || `segment-${index + 1}`);
        const segmentTitle = typeof segment.title === 'string' && segment.title.trim().length > 0
            ? segment.title.trim()
            : `分段 ${index + 1}`;
        const segmentContent = asRecord(segment.content) || {};
        const strategyType = String(segment.strategyType || '');

        if (strategyType === 'rubric_matrix') {
            asRecordArray(segmentContent.dimensions).forEach((dimension, dimIndex) => {
                const topScore = asRecordArray(dimension.levels).reduce((best, level) => Math.max(best, Number(level.score) || 0), 0);
                rows.push({
                    id: `${segmentId}:${String(dimension.id || `dimension-${dimIndex + 1}`)}`,
                    content: `${segmentTitle} · ${String(dimension.name || '')}`.trim(),
                    score: topScore
                });
            });
            return;
        }

        const points = strategyType === 'sequential_logic'
            ? asRecordArray(segmentContent.steps)
            : asRecordArray(segmentContent.points);
        points.forEach((point, pointIndex) => {
            rows.push({
                id: `${segmentId}:${String(point.id || `point-${pointIndex + 1}`)}`,
                content: String(point.content || ''),
                score: Number(point.score) || 0
            });
        });
    });

    return rows;
}

function getPointRows(rubric: RubricJSONV3): Array<{ id: string; content: string; score: number }> {
    const segmentRows = resolveSegmentRows(rubric);
    if (segmentRows.length > 0) return segmentRows;

    if (rubric.strategyType === 'rubric_matrix') {
        return (rubric.content.dimensions || []).map((dimension) => {
            const topScore = dimension.levels.reduce((best, level) => Math.max(best, level.score), 0);
            return {
                id: dimension.id,
                content: dimension.name,
                score: topScore
            };
        });
    }

    const points: RubricPoint[] = rubric.strategyType === 'sequential_logic'
        ? (rubric.content.steps || [])
        : (rubric.content.points || []);

    return points.map((point) => ({
        id: point.id,
        content: point.content,
        score: point.score
    }));
}

function getTotalScore(rubric: RubricJSONV3): number {
    const content = asRecord(rubric.content) || {};
    const segments = asRecordArray(content.segments);
    if (segments.length > 0) {
        if (typeof content.totalScore === 'number') return content.totalScore;
        const aggregation = content.aggregation === 'weighted_sum' || content.aggregation === 'max'
            ? content.aggregation
            : 'sum';
        const segmentMaxList = segments.map((segment) => {
            const segmentContent = asRecord(segment.content) || {};
            if (typeof segment.maxScore === 'number') return Math.max(0, segment.maxScore);
            if (typeof segmentContent.totalScore === 'number') return Math.max(0, segmentContent.totalScore);
            if (segment.strategyType === 'rubric_matrix') {
                return asRecordArray(segmentContent.dimensions).reduce((sum, dimension) => sum + (Number(dimension.weight) || 0), 0);
            }
            if (segment.strategyType === 'sequential_logic') {
                return asRecordArray(segmentContent.steps).reduce((sum, step) => sum + (Number(step.score) || 0), 0);
            }
            return asRecordArray(segmentContent.points).reduce((sum, point) => sum + (Number(point.score) || 0), 0);
        });
        if (aggregation === 'max') {
            return segmentMaxList.reduce((best, value) => Math.max(best, value), 0);
        }
        if (aggregation === 'weighted_sum') {
            return segments.reduce((sum, segment, index) => sum + Math.max(0, Number(segment.weight) || segmentMaxList[index]), 0);
        }
        return segmentMaxList.reduce((sum, value) => sum + value, 0);
    }

    if (rubric.strategyType === 'rubric_matrix') {
        return rubric.content.totalScore
            ?? (rubric.content.dimensions || []).reduce((sum, dimension) => sum + (dimension.weight ?? 0), 0);
    }

    const points = rubric.strategyType === 'sequential_logic'
        ? (rubric.content.steps || [])
        : (rubric.content.points || []);
    return rubric.content.totalScore ?? points.reduce((sum, point) => sum + point.score, 0);
}

function formatStrategyRule(rubric: RubricJSONV3, totalScore: number): string | null {
    if (rubric.strategyType === 'rubric_matrix') {
        return null;
    }
    const strategy = rubric.content.scoringStrategy || {
        type: 'weighted',
        allowAlternative: false,
        strictMode: false,
        openEnded: false
    };
    if (strategy.type === 'pick_n' && strategy.maxPoints) {
        return `> 评分规则：每点${strategy.pointValue ?? 2}分，答对任意${strategy.maxPoints}点得满分（${totalScore}分）`;
    }
    if (strategy.type === 'all') {
        return '> 评分规则：需答全所有得分点';
    }
    return '> 评分规则：按各得分点分值累加';
}

/**
 * 将 RubricJSONV3 转换为 Markdown（用于展示与预览）
 */
export function rubricToMarkdown(rubric: RubricJSONV3): string {
    const totalScore = getTotalScore(rubric);
    const lines: string[] = [];

    lines.push(`## 第${rubric.metadata.questionId}题评分细则（共${totalScore}分）`);
    lines.push('');
    lines.push(`### ${rubric.metadata.title}（${totalScore}分）`);
    lines.push('');
    lines.push('| 编号 | 答案 | 分值 |');
    lines.push('|------|------|------|');

    getPointRows(rubric).forEach((row) => {
        lines.push(`| ${row.id} | ${row.content} | ${row.score}分 |`);
    });

    const strategyRule = formatStrategyRule(rubric, totalScore);
    if (strategyRule) {
        lines.push('');
        lines.push(strategyRule);
        if (rubric.content.scoringStrategy.allowAlternative) {
            lines.push('> 其他答案言之成理亦可给分');
        }
    }

    if (rubric.constraints && rubric.constraints.length > 0) {
        lines.push('');
        lines.push('### 阅卷提示');
        rubric.constraints.forEach((constraint) => {
            lines.push(`- 【${constraint.type}】${constraint.description ?? ''}`);
        });
    }

    return lines.join('\n');
}

/**
 * 读取 JSON 文件并按 V3 校验
 */
export function parseRubricFile(content: string): RubricJSONV3 {
    try {
        const json = JSON.parse(content) as Partial<RubricJSONV3>;
        if (json.version !== '3.0' || !json.metadata || !json.strategyType || !json.content) {
            throw new Error('仅支持 RubricJSONV3 (version=3.0)');
        }
        return json as RubricJSONV3;
    } catch (error) {
        throw new Error(`解析评分细则失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

export function stringifyRubric(rubric: RubricJSONV3): string {
    return JSON.stringify(rubric, null, 2);
}
