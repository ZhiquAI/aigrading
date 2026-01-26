/**
 * excel-parser.ts - 评分细则结构化解析工具
 * 
 * 支持从 CSV 和 剪贴板文本（Tab 分隔）解析评分细则
 */

import type { RubricJSON, AnswerPoint } from '../types/rubric';
import { createEmptyRubric } from '../types/rubric';

/**
 * 从 CSV 文本解析评分细则
 */
export function parseRubricFromCSV(csvText: string, questionId: string = '1'): RubricJSON {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        throw new Error('CSV 文件内容不足（至少需要标题行和一行数据）');
    }

    // 默认列头索引
    const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());

    // 映射列名（兼容不同表头）
    const colIdx = {
        id: headers.findIndex(h => h.includes('编号') || h.includes('号') || h === 'id'),
        segment: headers.findIndex(h => h.includes('问题词') || h.includes('片段') || h.includes('segment')),
        content: headers.findIndex(h => h.includes('答案') || h.includes('内容') || h === 'content'),
        keywords: headers.findIndex(h => h.includes('关键词') || h === 'keywords'),
        score: headers.findIndex(h => h.includes('分值') || h.includes('分数') || h === 'score'),
    };

    const rubric = createEmptyRubric(questionId);
    const answerPoints: AnswerPoint[] = [];

    // 从第二行开始解析数据
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cells.length < 2) continue;

        const point: AnswerPoint = {
            id: colIdx.id !== -1 ? cells[colIdx.id] : `${questionId}-${i}`,
            questionSegment: colIdx.segment !== -1 ? cells[colIdx.segment] : '',
            content: colIdx.content !== -1 ? cells[colIdx.content] : cells[0],
            keywords: colIdx.keywords !== -1 ? cells[colIdx.keywords].split(/[、,;]\s*/).filter(k => k) : [],
            score: colIdx.score !== -1 ? parseInt(cells[colIdx.score]) || 2 : 2,
        };
        answerPoints.push(point);
    }

    rubric.answerPoints = answerPoints;
    rubric.totalScore = answerPoints.reduce((sum, p) => sum + p.score, 0);
    rubric.title = '导入的评分表';

    return rubric;
}

/**
 * 从剪贴板粘贴的文本（Tab 分隔）解析评分细则
 * 这种模式通常用于从 Word/Excel 直接复制粘贴
 */
export function parseRubricFromClipboard(text: string, questionId: string = '1'): RubricJSON {
    // 首先尝试 CSV 解析器（它也支持 Tab）
    try {
        const rubric = parseRubricFromCSV(text, questionId);
        if (rubric.answerPoints.length > 0) return rubric;
    } catch (e) {
        // 继续尝试后备方案
    }

    // 后备方案：逐行解析
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const rubric = createEmptyRubric(questionId);
    const points: AnswerPoint[] = [];

    lines.forEach((line, index) => {
        // 如果包含 Tab，按 Tab 分隔；否则按多个空格分隔
        const parts = line.includes('\t')
            ? line.split('\t').map(p => p.trim())
            : line.split(/\s{2,}/).map(p => p.trim());

        if (parts.length >= 2) {
            // 简单的映射逻辑：如果一部分看起来像分数，把它作为分数
            let score = 2;
            let contentIdx = 0;
            let kwIdx = -1;

            // 尝试寻找分数列
            const scoreIdx = parts.findIndex(p => /^(\d+)(分|pts)?$/.test(p));
            if (scoreIdx !== -1) {
                score = parseInt(parts[scoreIdx]) || 2;
                // 内容通常在分数左侧或右侧
                contentIdx = scoreIdx === 0 ? 1 : 0;
            }

            points.push({
                id: `${questionId}-${index + 1}`,
                content: parts[contentIdx],
                keywords: kwIdx !== -1 ? [parts[kwIdx]] : [],
                score: score
            });
        }
    });

    rubric.answerPoints = points;
    rubric.totalScore = points.reduce((s, p) => s + p.score, 0);
    return rubric;
}
