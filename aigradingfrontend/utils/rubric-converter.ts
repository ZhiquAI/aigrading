/**
 * rubric-converter.ts - 评分细则格式转换器（V3 only）
 */

import type { RubricJSONV3, RubricPoint } from '../types/rubric-v3';

function getPointRows(rubric: RubricJSONV3): Array<{ id: string; content: string; score: number }> {
    if (rubric.strategyType === 'rubric_matrix') {
        return rubric.content.dimensions.map((dimension) => {
            const topScore = dimension.levels.reduce((best, level) => Math.max(best, level.score), 0);
            return {
                id: dimension.id,
                content: dimension.name,
                score: topScore
            };
        });
    }

    const points: RubricPoint[] = rubric.strategyType === 'sequential_logic'
        ? rubric.content.steps
        : rubric.content.points;

    return points.map((point) => ({
        id: point.id,
        content: point.content,
        score: point.score
    }));
}

function getTotalScore(rubric: RubricJSONV3): number {
    if (rubric.strategyType === 'rubric_matrix') {
        return rubric.content.totalScore
            ?? rubric.content.dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 0), 0);
    }

    const points = rubric.strategyType === 'sequential_logic' ? rubric.content.steps : rubric.content.points;
    return rubric.content.totalScore ?? points.reduce((sum, point) => sum + point.score, 0);
}

function formatStrategyRule(rubric: RubricJSONV3, totalScore: number): string | null {
    if (rubric.strategyType === 'rubric_matrix') {
        return null;
    }
    const strategy = rubric.content.scoringStrategy;
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
