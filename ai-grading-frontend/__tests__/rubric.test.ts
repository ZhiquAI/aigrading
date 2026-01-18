/**
 * rubric.test.ts - 评分细则类型和工具函数测试
 */

import { describe, it, expect } from 'vitest';
import {
    createEmptyRubric,
    createEmptyAnswerPoint,
    parseRubricJSON,
    type RubricJSON,
} from '../types/rubric';
import { rubricToMarkdown, markdownToRubric } from '../utils/rubric-converter';

describe('RubricJSON Types', () => {
    describe('createEmptyRubric', () => {
        it('应创建正确的空白评分细则', () => {
            const rubric = createEmptyRubric('18-2');

            expect(rubric.version).toBe('2.0');
            expect(rubric.questionId).toBe('18-2');
            expect(rubric.title).toBe('');
            expect(rubric.totalScore).toBe(6);
            expect(rubric.scoringStrategy.type).toBe('pick_n');
            expect(rubric.scoringStrategy.maxPoints).toBe(3);
            expect(rubric.scoringStrategy.strictMode).toBe(true);
            expect(rubric.answerPoints).toEqual([]);
            expect(rubric.gradingNotes).toContain('严格按照参考答案评分');
            expect(rubric.createdAt).toBeDefined();
            expect(rubric.updatedAt).toBeDefined();
        });
    });

    describe('createEmptyAnswerPoint', () => {
        it('应创建正确的空白得分点', () => {
            const point = createEmptyAnswerPoint('2-1');

            expect(point.id).toBe('2-1');
            expect(point.content).toBe('');
            expect(point.keywords).toEqual([]);
            expect(point.score).toBe(2);
        });
    });

    describe('parseRubricJSON', () => {
        it('应正确解析 v2 格式', () => {
            const input: RubricJSON = {
                version: '2.0',
                questionId: '18-2',
                title: '影响分析',
                totalScore: 6,
                createdAt: '2026-01-16T00:00:00.000Z',
                updatedAt: '2026-01-16T00:00:00.000Z',
                scoringStrategy: {
                    type: 'pick_n',
                    maxPoints: 3,
                    pointValue: 2,
                    allowAlternative: false,
                    strictMode: true,
                },
                answerPoints: [
                    { id: '2-1', content: '破坏了中国的领土主权', keywords: ['领土主权'], score: 2 },
                ],
                gradingNotes: ['严格按照参考答案评分'],
            };

            const result = parseRubricJSON(input);

            expect(result.version).toBe('2.0');
            expect(result.questionId).toBe('18-2');
            expect(result.answerPoints.length).toBe(1);
        });

        it('应拒绝非 v2 格式', () => {
            const input = { version: '1.0', questionId: '18-2' };

            expect(() => parseRubricJSON(input)).toThrow('不支持的评分细则版本');
        });

        it('应拒绝无效输入', () => {
            expect(() => parseRubricJSON(null)).toThrow('无效的评分细则 JSON');
            expect(() => parseRubricJSON('string')).toThrow('无效的评分细则 JSON');
        });
    });
});

describe('RubricConverter', () => {
    const sampleRubric: RubricJSON = {
        version: '2.0',
        questionId: '18-2',
        title: '影响分析',
        totalScore: 6,
        createdAt: '2026-01-16T00:00:00.000Z',
        updatedAt: '2026-01-16T00:00:00.000Z',
        scoringStrategy: {
            type: 'pick_n',
            maxPoints: 3,
            pointValue: 2,
            allowAlternative: false,
            strictMode: true,
        },
        answerPoints: [
            { id: '2-1', content: '破坏了中国的领土主权', keywords: ['领土主权', '主权'], score: 2 },
            { id: '2-2', content: '加剧了中国边疆危机', keywords: ['边疆危机'], score: 2 },
        ],
        gradingNotes: ['严格按照参考答案评分', '任答3点得满分'],
    };

    describe('rubricToMarkdown', () => {
        it('应正确转换为 Markdown', () => {
            const markdown = rubricToMarkdown(sampleRubric);

            expect(markdown).toContain('## 第18-2题评分细则（共6分）');
            expect(markdown).toContain('### 影响分析（6分）');
            expect(markdown).toContain('| 编号 | 答案 | 分值 |');
            expect(markdown).toContain('| 2-1 | 破坏了中国的领土主权 | 2分 |');
            expect(markdown).toContain('| 2-2 | 加剧了中国边疆危机 | 2分 |');
            expect(markdown).toContain('📋 评分规则');
            expect(markdown).toContain('### 阅卷提示');
        });
    });

    describe('markdownToRubric', () => {
        it('应尽力解析 Markdown 到 Rubric', () => {
            const markdown = `
## 第18-2题评分细则（共6分）

### (2) 影响分析（6分）

| 编号 | 答案 | 分值 |
|------|------|------|
| 2-1 | 破坏了中国的领土主权 | 2分 |
| 2-2 | 加剧了中国边疆危机 | 2分 |

> 📋 评分规则：每点2分，答对任意3点得满分（6分）

### 阅卷提示
- 严格按照参考答案评分
            `;

            const result = markdownToRubric(markdown);

            expect(result.version).toBe('2.0');
            expect(result.totalScore).toBe(6);
            expect(result.answerPoints?.length).toBe(2);
            expect(result.answerPoints?.[0].id).toBe('2-1');
            expect(result.scoringStrategy?.type).toBe('pick_n');
            expect(result.scoringStrategy?.maxPoints).toBe(3);
        });
    });
});
