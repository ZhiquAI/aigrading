/**
 * rubric-converter.ts - 评分细则格式转换器
 * 
 * JSON ↔ Markdown 双向转换
 */

import { RubricJSON, AnswerPoint, parseRubricJSON } from '../types/rubric';

// ==================== JSON → Markdown ====================

/**
 * 将 RubricJSON 转换为 Markdown 格式（用于预览）
 */
export function rubricToMarkdown(rubric: RubricJSON): string {
    const lines: string[] = [];

    // 标题
    lines.push(`## 第${rubric.questionId}题评分细则（共${rubric.totalScore}分）`);
    lines.push('');

    // 小题标题
    lines.push(`### ${rubric.title}（${rubric.totalScore}分）`);
    lines.push('');

    // 得分点表格
    lines.push('| 编号 | 答案 | 分值 |');
    lines.push('|------|------|------|');

    for (const point of rubric.answerPoints) {
        lines.push(`| ${point.id} | ${point.content} | ${point.score}分 |`);
    }
    lines.push('');

    // 评分规则
    const strategy = rubric.scoringStrategy;
    if (strategy.type === 'pick_n' && strategy.maxPoints) {
        lines.push(`> 📋 评分规则：每点${strategy.pointValue || 2}分，答对任意${strategy.maxPoints}点得满分（${rubric.totalScore}分）`);
    } else if (strategy.type === 'all') {
        lines.push(`> 📋 评分规则：需答全所有得分点`);
    } else {
        lines.push(`> 📋 评分规则：按各得分点分值累加`);
    }

    if (strategy.allowAlternative) {
        lines.push(`> 其他答案言之成理亦可给分`);
    }
    lines.push('');

    // 阅卷提示
    if (rubric.gradingNotes.length > 0) {
        lines.push('### 阅卷提示');
        for (const note of rubric.gradingNotes) {
            lines.push(`- ${note}`);
        }
    }

    return lines.join('\n');
}

// ==================== Markdown → JSON ====================

/**
 * 从 Markdown 解析评分细则（尽力解析，不完美匹配也返回部分结果）
 */
export function markdownToRubric(markdown: string, questionId?: string): Partial<RubricJSON> {
    const result: Partial<RubricJSON> = {
        version: '2.0',
        answerPoints: [],
        gradingNotes: [],
    };

    // 解析题号和总分
    const titleMatch = markdown.match(/第(\d+-?\d*)题.*?（共(\d+)分）/);
    if (titleMatch) {
        result.questionId = questionId || titleMatch[1];
        result.totalScore = parseInt(titleMatch[2], 10);
    }

    // 解析小题标题
    const subtitleMatch = markdown.match(/###\s*(?:\(\d+\))?\s*(.+?)（(\d+)分）/);
    if (subtitleMatch) {
        result.title = subtitleMatch[1].trim();
    }

    // 解析表格中的得分点
    const tableRows = markdown.match(/\|\s*(\d+-\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)分?\s*\|/g);
    if (tableRows) {
        result.answerPoints = tableRows.map(row => {
            const match = row.match(/\|\s*(\d+-\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)分?\s*\|/);
            if (match) {
                return {
                    id: match[1],
                    content: match[2].trim(),
                    keywords: extractKeywords(match[2]),
                    score: parseInt(match[3], 10),
                };
            }
            return null;
        }).filter((p): p is AnswerPoint => p !== null);
    }

    // 解析评分规则
    const pickNMatch = markdown.match(/答对任意(\d+)点/);
    const pointValueMatch = markdown.match(/每点(\d+)分/);

    result.scoringStrategy = {
        type: pickNMatch ? 'pick_n' : 'weighted',
        maxPoints: pickNMatch ? parseInt(pickNMatch[1], 10) : undefined,
        pointValue: pointValueMatch ? parseInt(pointValueMatch[1], 10) : 2,
        allowAlternative: /言之成理|其他答案/.test(markdown),
        strictMode: /严格/.test(markdown),
    };

    // 解析阅卷提示
    const notesMatch = markdown.match(/### 阅卷提示\n([\s\S]*?)(?=\n###|\n---|$)/);
    if (notesMatch) {
        result.gradingNotes = notesMatch[1]
            .split('\n')
            .map(line => line.replace(/^[-*]\s*/, '').trim())
            .filter(line => line.length > 0);
    }

    return result;
}

/**
 * 从答案内容中提取关键词（简单分词）
 */
function extractKeywords(content: string): string[] {
    // 移除标点符号，按常见分隔符分割
    const cleaned = content.replace(/[，。、；：""''（）【】]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

    // 取前3个有意义的词作为关键词
    return words.slice(0, 3);
}

// ==================== 批量转换 ====================

/**
 * 读取 JSON 文件内容并解析为 RubricJSON
 */
export function parseRubricFile(content: string): RubricJSON {
    try {
        const json = JSON.parse(content);
        return parseRubricJSON(json);
    } catch (error) {
        throw new Error(`解析评分细则失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
}

/**
 * 将 RubricJSON 序列化为格式化的 JSON 字符串
 */
export function stringifyRubric(rubric: RubricJSON): string {
    return JSON.stringify(rubric, null, 2);
}

// ==================== 导出用于 AI 生成 ====================

/**
 * 生成 AI 可理解的评分细则模板说明
 */
export function getRubricTemplatePrompt(): string {
    return `
请生成符合以下 JSON 格式的评分细则：

\`\`\`json
{
  "version": "2.0",
  "questionId": "题号",
  "title": "题目类型",
  "totalScore": 6,
  "scoringStrategy": {
    "type": "pick_n",
    "maxPoints": 3,
    "pointValue": 2,
    "allowAlternative": false,
    "strictMode": true
  },
  "answerPoints": [
    {
      "id": "1-1",
      "content": "具体答案内容",
      "keywords": ["关键词1", "关键词2"],
      "score": 2
    }
  ],
  "gradingNotes": ["阅卷提示"]
}
\`\`\`

注意事项：
1. questionId 格式为 "题号-小题号"，如 "18-2"
2. keywords 数组中的关键词用于自动匹配，支持 "关键词1+关键词2" 表示需同时包含
3. scoringStrategy.type 可选值: "pick_n"(任选N点), "all"(全答), "weighted"(加权)
`;
}
