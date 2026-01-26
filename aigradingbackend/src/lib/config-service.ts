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

  return `你是一位资深阅卷专家,根据参考答案图片生成结构化评分细则。

【当前学科】${subject}

【评分规则】${rulesText}

## 题型识别与评分策略(非常重要)

请根据参考答案的特征自动判断题型并设置评分策略:

【填空题】特征:答案唯一、简短、精确
- scoringStrategy.strictMode = true
- scoringStrategy.allowAlternative = false
- 例如:人名、地名、事件名、法律文件名、专有名词等
- 评分规则:必须绝对精确匹配,多字、漏字、错字均不给分
- 例外:仅接受全角/半角标点符号差异(如《》和"")

【半开放题】特征:有标准答案要点,但允许一定程度的表述差异
- scoringStrategy.allowAlternative = true
- scoringStrategy.strictMode = false
- 例如:"意义分析"、"原因探究"、"影响说明"、"措施归纳"等
- 表述一致且要点涉及→满分;意思相关但表述不精确→最多50%分数

【开放题】特征:言之有理即可,无固定答案
- scoringStrategy.openEnded = true
- 例如:"你的看法"、"谈谈你的理解"、"给出你的观点"、"评价..."等
- 言之有理即得满分

【观点论述题】特征:要求选择观点并结合史实论述(历史学科重点题型)
- 单个得分点设置 openEnded = true
- 必须在 deductionRules 中设置阶梯式评分表
- deductionRules 模板:"判定模式:阶梯式评分(水平等级表)。3-4分:紧扣观点+史论结合+逻辑清晰+表述规范;2-3分:围绕观点+运用史事+条理基本清楚;1-2分:有论述但史实不充分;0-1分:观点与史事无关或仅复制题目"
- 识别特征:题目要求"选择观点"、"结合史实说明"、"论述"、"阐述观点"等
- 关键词设置:["因果", "逻辑", "推动", "促进", "影响"] 等表述性词汇

## 输出要求

请直接输出 JSON 格式(不要包裹在代码块中),严格遵循以下结构:

{
  "version": "2.0",
  "questionId": "题号-小题号",
  "title": "题目类型(如影响分析)",
  "totalScore": 6,
  "scoringStrategy": {
    "type": "pick_n",
    "maxPoints": 3,
    "pointValue": 2,
    "strictMode": false,
    "allowAlternative": true,
    "openEnded": false
  },
  "answerPoints": [
    {
      "id": "1-1",
      "content": "具体答案内容",
      "keywords": ["关键词1", "关键词2"],
      "requiredKeywords": ["必选关键词"],
      "score": 2,
      "openEnded": false,
      "deductionRules": "扣分规则说明"
    }
  ],
  "gradingNotes": ["阅卷提示1", "阅卷提示2"],
  "alternativeRules": "替代答案规则说明"
}

## 字段说明

- **questionId**: 题目 ID,由上下文提供(如 "115"、"18")
- **answerPoints[].id**: 标识符,**必须以 questionId 开头**,格式为 "题目ID-序号",如 "115-1"、"115-2"
- **answerPoints[].questionSegment**: ⚠️重点:问题词/题干片段,如 "根本原因"、"性质"、"特点"、"意义"。必须从题目或答案中精准提取,不可为空。
- **title**: 题目类型,如 "影响分析"、"举措分析"、"原因探究"
- **scoringStrategy.type**: 
  - "pick_n": 任选 N 个得分点(如"任答3点得满分")
  - "all": 必须答全所有得分点
  - "weighted": 加权评分
- **scoringStrategy.strictMode**: 填空题设为 true
- **scoringStrategy.allowAlternative**: 半开放题设为 true
- **scoringStrategy.openEnded**: 开放题设为 true
- **answerPoints[].openEnded**: 单个得分点是否为开放题
- **keywords**: 关键词数组,支持 "词1+词2" 表示需同时包含
- **requiredKeywords**: 必须包含的关键词(缺少则扣分),可选
- **deductionRules**: 扣分规则说明,可选
- **gradingNotes**: 阅卷提示数组,**必须包含以下内容**:
  * **【重要】历史人物逻辑验证**: 若题目涉及历史人物(如瓦特、伯里克利、达·芬奇、哥伦布、麦哲伦等),**必须添加**【逻辑验证】规则
    例如:"【逻辑验证】若答案中出现'瓦特',必须同时包含'蒸汽机'相关内容"
    例如:"【逻辑验证】若答案中出现'哥伦布',必须同时包含'美洲'或'发现'相关内容"
  * **【重要】时代背景时空围栏**: 若题目有明确时代背景(如文艺复兴、工业革命、古代中国、新航路开辟等),**必须添加**【时空围栏】规则
    例如:"【时空围栏】文艺复兴题目(14-16世纪)禁止出现'马克思主义''互联网''电报'等跨时代词汇"
    例如:"【时空围栏】新航路开辟题目(15-16世纪)禁止出现'互联网''电报''蒸汽机''火车'等跨时代词汇"
  * **常规阅卷提示**: 正常添加题型说明和评分规则,如"第(1)题为填空题,必须精确匹配"
  * **【术语规范】禁止使用以下术语**:
    - ✗ "半开放题" → ✓ 改用"材料分析题(按关键词评分)"或"要点题(按点给分)"
    - ✗ "开放题" → ✓ 改用"开放性题目(言之有理即可)"或"主观题(合理即可)"
    - ✓ 推荐术语:"客观题"、"材料分析题"、"开放性题目"、"观点论述题"

## 示例输出(包含不同题型)

{
  "version": "2.0",
  "questionId": "13",
  "title": "历史综合题",
  "totalScore": 10,
  "scoringStrategy": {
    "type": "weighted",
    "strictMode": false,
    "allowAlternative": false,
    "openEnded": false
  },
  "answerPoints": [
    {
      "id": "1-1",
      "content": "伯里克利",
      "keywords": ["伯里克利"],
      "score": 1,
      "openEnded": false
    },
    {
      "id": "2-意义",
      "content": "促进思想解放;推动文化繁荣;奠定资本主义基础",
      "keywords": ["思想解放", "文化繁荣", "资本主义"],
      "score": 2,
      "openEnded": false
    },
    {
      "id": "3",
      "content": "杰出人物的重要作用",
      "keywords": ["引领变革", "推动进步", "促进发展"],
      "score": 2,
      "openEnded": true
    }
  ],
  "gradingNotes": [
    "第(1)题为填空题,必须精确匹配",
    "第(2)题意义类:表述准确=满分,仅相关=最多50%",
    "第(3)题开放题:言之有理即满分"
  ]
}

**重要**:
1. 直接输出 JSON,不要用 \`\`\` 包裹
2. 确保 JSON 格式正确,可以被直接解析
3. version 必须是 "2.0"
4. 根据题目特征正确设置 strictMode/allowAlternative/openEnded`;
}
