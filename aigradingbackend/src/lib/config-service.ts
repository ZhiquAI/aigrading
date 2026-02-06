/**
 * config-service.ts - 配置管理服务(后端版本)
 * 
 * 与前端保持一致的学科规则和 Prompt 生成
 */

// ==================== 学科评分规则配置 ====================

export type QuestionType = 'fillBlank' | 'shortAnswer' | 'openEnded';

export interface QuestionRule {
  enabled: boolean;
  rule: string;
}

export interface SubjectRules {
  subject: string;
  rules: {
    fillBlank: QuestionRule;
    shortAnswer: QuestionRule;
    openEnded: QuestionRule;
  };
}

// 默认学科规则
export const DEFAULT_SUBJECT_RULES: Record<string, SubjectRules> = {
  '历史': {
    subject: '历史',
    rules: {
      fillBlank: { enabled: true, rule: '错字不得分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '言之有理即可' }
    }
  },
  '语文': {
    subject: '语文',
    rules: {
      fillBlank: { enabled: true, rule: '错字扣1分,漏字扣1分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '言之有理即可' }
    }
  },
  '政治': {
    subject: '政治',
    rules: {
      fillBlank: { enabled: true, rule: '错字不得分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '言之有理即可' }
    }
  },
  '地理': {
    subject: '地理',
    rules: {
      fillBlank: { enabled: true, rule: '错字不得分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '言之有理即可' }
    }
  }
};

/**
 * 获取当前学科(后端默认历史)
 */
export function getCurrentSubject(): string {
  return '历史';
}

/**
 * 生成评分规则提示文本(用于 AI 提示词)
 */
export function generateRulesPrompt(subject?: string): string {
  const targetSubject = subject || getCurrentSubject();
  const rules = DEFAULT_SUBJECT_RULES[targetSubject] || DEFAULT_SUBJECT_RULES['历史'];
  const parts: string[] = [];

  if (rules.rules.fillBlank.enabled) {
    parts.push(`填空题:${rules.rules.fillBlank.rule}`);
  }
  if (rules.rules.shortAnswer.enabled) {
    parts.push(`简答题:${rules.rules.shortAnswer.rule}`);
  }
  if (rules.rules.openEnded.enabled) {
    parts.push(`开放题:${rules.rules.openEnded.rule}`);
  }

  return parts.join(',');
}

/**
 * 生成评分细则的 System Prompt(JSON 格式输出)
 * 与前端 rubric-service.ts 保持一致
 */
export function getRubricSystemPrompt(): string {
  const subject = getCurrentSubject();
  const rulesText = generateRulesPrompt(subject);

  return `你是一位资深阅卷专家，请基于参考答案生成 Rubric v3 评分细则 JSON。

【当前学科】${subject}
【评分规则】${rulesText}

## 必须遵守
1. 仅输出 JSON，不要 Markdown 代码块
2. version 必须是 "3.0"
3. 必须包含字段：metadata / strategyType / content / createdAt / updatedAt
4. content 结构必须与 strategyType 对应
5. 不允许输出任何旧版字段（仅允许 Rubric v3 规范字段）

## 题型与策略映射
- 客观题/填空题/要点题：strategyType = "point_accumulation"
- 过程题/证明题/步骤题：strategyType = "sequential_logic"
- 作文/论述/分层评价：strategyType = "rubric_matrix"

## 输出结构
{
  "version": "3.0",
  "metadata": {
    "questionId": "13",
    "title": "历史综合题",
    "subject": "${subject}",
    "grade": "九年级",
    "questionType": "材料题",
    "examName": "期末考试"
  },
  "strategyType": "point_accumulation",
  "content": {
    "scoringStrategy": {
      "type": "weighted",
      "strictMode": false,
      "allowAlternative": true,
      "openEnded": false
    },
    "points": [
      {
        "id": "13-1",
        "questionSegment": "原因",
        "content": "资本主义萌芽",
        "keywords": ["资本主义"],
        "score": 2
      }
    ],
    "totalScore": 6
  },
  "constraints": [
    {
      "id": "c1",
      "type": "阅卷提示",
      "description": "按关键词给分"
    }
  ],
  "createdAt": "2026-02-06T00:00:00.000Z",
  "updatedAt": "2026-02-06T00:00:00.000Z"
}`;
}
