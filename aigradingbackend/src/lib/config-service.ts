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

const SUBJECT_ALIASES: Record<string, string> = {
  政治: '道法'
};

export function normalizeSubjectValue(subject?: string): string {
  const raw = (subject || '').trim();
  return SUBJECT_ALIASES[raw] || raw;
}

// 默认学科规则（与前端保持一致，覆盖全学科）
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
  '道法': {
    subject: '道法',
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
  },
  '数学': {
    subject: '数学',
    rules: {
      fillBlank: { enabled: true, rule: '答案错误不得分' },
      shortAnswer: { enabled: true, rule: '按步骤给分' },
      openEnded: { enabled: true, rule: '方法正确即可' }
    }
  },
  '物理': {
    subject: '物理',
    rules: {
      fillBlank: { enabled: true, rule: '答案错误不得分，单位错误扣分' },
      shortAnswer: { enabled: true, rule: '按步骤给分' },
      openEnded: { enabled: true, rule: '原理正确即可' }
    }
  },
  '化学': {
    subject: '化学',
    rules: {
      fillBlank: { enabled: true, rule: '化学式错误不得分' },
      shortAnswer: { enabled: true, rule: '按步骤给分' },
      openEnded: { enabled: true, rule: '原理正确即可' }
    }
  },
  '生物': {
    subject: '生物',
    rules: {
      fillBlank: { enabled: true, rule: '错字不得分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '言之有理即可' }
    }
  },
  '英语': {
    subject: '英语',
    rules: {
      fillBlank: { enabled: true, rule: '拼写错误不得分' },
      shortAnswer: { enabled: true, rule: '按点给分' },
      openEnded: { enabled: true, rule: '表达正确即可' }
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
  const targetSubject = normalizeSubjectValue(subject || getCurrentSubject());
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
export function getRubricSystemPrompt(subject?: string): string {
  const resolvedSubject = normalizeSubjectValue(subject || getCurrentSubject());
  const rulesText = generateRulesPrompt(resolvedSubject);

  return `你是一位资深阅卷专家，请基于参考答案生成 Rubric v3 评分细则 JSON。

【当前学科】${resolvedSubject}
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

## 多小问拆分规则（强制）
- 若参考答案存在 "(1)(2)(3)"、"第1问/第2问" 等多小问结构，必须输出 content.segments（每个小问一个 segment）
- 每个 segment 必须独立配置 scoringStrategy（例如：客观题=all，材料分析=weighted，任答类=pick_n）
- 整题 content 使用 aggregation="sum"，并通过 totalScore 汇总小问分值
- 禁止把不同小问混在同一个 points/steps 列表里

## 输出结构
{
  "version": "3.0",
  "metadata": {
    "questionId": "13",
    "title": "历史综合题",
    "subject": "${resolvedSubject}",
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
