import { RubricJSONV3 } from './rubric-v3';

export interface JudgeCheckpoint {
    met: boolean;
    evidence?: string;
}

export interface JudgeDimension {
    level?: string;
    score?: number;
    evidence?: string;
}

export interface JudgeResult {
    confidence: number;
    needsReview?: boolean;
    checkpoints?: Record<string, JudgeCheckpoint>;
    dimensions?: Record<string, JudgeDimension>;
    notes?: string;
}

export function buildJudgePrompt(rubric: RubricJSONV3): string {
    const base = `你是专业阅卷助手。请根据评分细则判断学生答案是否满足各个得分点/维度。
你只做“判定”，不要计算总分。

【评分细则JSON】
${JSON.stringify(rubric)}

【输出要求】
1. 只输出 JSON，不要 Markdown
2. 统一输出格式如下：
{
  "confidence": 0.0-1.0,
  "needsReview": false,
  "checkpoints": {
    "id": { "met": true, "evidence": "简短依据" }
  },
  "dimensions": {
    "dimensionId": { "level": "A", "score": 8, "evidence": "简短依据" }
  },
  "notes": "补充说明(可选)"
}

【判定规则】
- point_accumulation / sequential_logic 使用 checkpoints
- rubric_matrix 使用 dimensions
- evidence 简短即可，不要抄学生答案原文`;

    return base;
}

export function parseJudgeResult(content: string): JudgeResult {
    const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('无法解析判定结果');
    }
    const parsed = JSON.parse(match[0]);
    return {
        confidence: Number(parsed.confidence) || 0.7,
        needsReview: !!parsed.needsReview,
        checkpoints: parsed.checkpoints || undefined,
        dimensions: parsed.dimensions || undefined,
        notes: parsed.notes
    };
}
