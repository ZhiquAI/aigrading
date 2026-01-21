/**
 * rubric-service.ts - 评分细则服务
 * 
 * AI 直接生成 RubricJSON v2 格式
 */

import type { RubricJSON } from '../types/rubric';
import { parseRubricJSON } from '../types/rubric';
import { generateRulesPrompt, getCurrentSubject } from './config-service';

// ==================== 配置 ====================
// @ts-ignore - Vite 环境变量
const BACKEND_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

function getDeviceId(): string {
    return localStorage.getItem('app_device_id') || 'unknown';
}

// ==================== JSON 格式提示词 ====================

/**
 * 生成评分细则的 System Prompt（JSON 格式输出）
 */
export function getRubricSystemPrompt(): string {
    const subject = getCurrentSubject();
    const rulesText = generateRulesPrompt(subject);

    return `你是一位资深阅卷专家,根据参考答案图片生成结构化评分细则。

【当前学科】${subject}

【评分规则】${rulesText}

## ⚠️ 强制术语规范(必须遵守)

**gradingNotes中严格禁止使用以下术语**:
- ❌ 禁止: "半开放题"、"开放题"
- ✅ 必须使用: "客观题(答案固定)"、"材料分析题(关键词评分)"、"开放性题目(合理即可)"、"观点论述题(分层评分)"

**示例(正确)**:
- "第(1)题为客观题,答案必须精确匹配"
- "第(2)题为材料分析题,按关键词给分"
- "第(3)题为开放性题目,言之有理即可"

**示例(错误,严禁使用)**:
- ❌ "第(1)题为半开放题" 
- ❌ "第(2)题为开放题"

## 题型识别与评分策略(非常重要)

请根据参考答案的特征自动判断题型并设置评分策略:

【填空题/客观题】特征:答案唯一、简短、精确
- scoringStrategy.strictMode = true
- scoringStrategy.allowAlternative = false
- 例如:人名、地名、事件名、法律文件名、专有名词等
- 评分规则:必须绝对精确匹配,多字、漏字,错字均不给分
- 例外:仅接受全角/半角标点符号差异(如《》和"")
- **gradingNotes**: "第(X)题为客观题,答案必须精确匹配"

【材料分析题/要点题】特征:有标准答案要点,但允许一定程度的表述差异
- scoringStrategy.allowAlternative = true
- scoringStrategy.strictMode = false
- 例如:"意义分析"、"原因探究"、"影响说明"、"措施归纳"等
- 表述一致且要点涉及→满分;意思相关但表述不精确→最多50%分数
- **gradingNotes**: "第(X)题为材料分析题,按关键词给分"

【开放性题目】特征:言之有理即可,无固定答案
- scoringStrategy.openEnded = true
- 例如:"你的看法"、"谈谈你的理解"、"给出你的观点"、"评价..."等
- 言之有理即得满分
- **gradingNotes**: "第(X)题为开放性题目,言之有理即可"

【观点论述题】特征:要求选择观点并结合史实论述(历史学科重点题型)
- 单个得分点设置 openEnded = true
- 必须在 deductionRules 中设置阶梯式评分表
- deductionRules 模板:"判定模式:阶梯式评分(水平等级表)。3-4分:紧扣观点+史论结合+逻辑清晰+表述规范;2-3分:围绕观点+运用史事+条理基本清楚;1-2分:有论述但史实不充分;0-1分:观点与史事无关或仅复制题目"
- 识别特征:题目要求"选择观点"、"结合史实说明"、"论述"、"阐述观点"等
- 关键词设置:["因果", "逻辑", "推动", "促进", "影响"] 等表述性词汇
- **gradingNotes**: "第(X)题为观点论述题,采用阶梯式评分"

## 输出要求

请直接输出 JSON 格式（不要包裹在代码块中），严格遵循以下结构：

{
  "version": "2.0",
  "questionId": "题号-小题号",
  "title": "题目类型（如影响分析）",
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

- **questionId**: 格式为 "题号-小题号"，如 "18-2"、"19-1"
- **title**: 题目类型，如 "影响分析"、"举措分析"、"原因探究"
- **scoringStrategy.type**: 
  - "pick_n": 任选 N 个得分点（如"任答3点得满分"）
  - "all": 必须答全所有得分点
  - "weighted": 加权评分
- **scoringStrategy.strictMode**: 填空题设为 true
- **scoringStrategy.allowAlternative**: 半开放题设为 true
- **scoringStrategy.openEnded**: 开放题设为 true
- **answerPoints[].openEnded**: 单个得分点是否为开放题
- **keywords**: 关键词数组，支持 "词1+词2" 表示需同时包含
- **requiredKeywords**: 必须包含的关键词（缺少则扣分），可选
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

## 示例输出（包含不同题型）

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
      "content": "促进思想解放；推动文化繁荣；奠定资本主义基础",
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
    "第(1)题为客观题,必须精确匹配",
    "第(2)题为材料分析题,表述准确=满分,仅相关=最多50%",
    "第(3)题为开放性题目,言之有理即满分",
    "【逻辑验证】若答案中出现'伯里克利',必须同时包含'雅典'或'民主'相关内容"
  ]
}

**重要**:
1. 直接输出 JSON,不要用 \\\`\\\`\\\` 包裹
2. 确保 JSON 格式正确,可以被直接解析
3. version 必须是 "2.0"
4. 根据题目特征正确设置 strictMode/allowAlternative/openEnded
5. **gradingNotes必须使用规范术语,严禁使用"半开放题"、"开放题"**`;
}

// ==================== API 调用 ====================

/**
 * 从图片生成评分细则（返回 RubricJSON）
 */
export async function generateRubricFromImages(
    questionImageBase64?: string | null,
    answerImageBase64?: string | null,
    questionId?: string
): Promise<RubricJSON> {
    if (!questionImageBase64 && !answerImageBase64) {
        throw new Error('至少需要提供试题图片或参考答案图片');
    }

    // 动态导入以避免循环依赖
    const { isProxyMode } = await import('./proxyService');
    const useProxy = isProxyMode();

    console.log('[generateRubricFromImages] Mode:', useProxy ? 'Backend Proxy' : 'Frontend Direct');

    if (useProxy) {
        // 后端代理模式：调用 localhost:3000
        try {
            const response = await fetch(`${BACKEND_URL} /api/ai / rubric / generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': getDeviceId(),
                },
                body: JSON.stringify({
                    questionImage: questionImageBase64,
                    answerImage: answerImageBase64,
                    questionId: questionId || 'unknown',
                    outputFormat: 'json',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status} `);
            }

            const data = await response.json();
            const rubricData = data.rubric || data.data?.rubric || data;

            if (typeof rubricData === 'string') {
                const cleaned = cleanJsonString(rubricData);
                return parseRubricJSON(JSON.parse(cleaned));
            }

            return parseRubricJSON(rubricData);
        } catch (error) {
            console.error('[generateRubricFromImages] Backend proxy failed:', error);
            throw new Error(`生成评分细则失败：${error instanceof Error ? error.message : '后端服务不可用'} `);
        }
    } else {
        // 前端直连模式：使用用户配置的 AI API
        try {
            const { callAI } = await import('./ai-router');

            const systemPrompt = getRubricSystemPrompt();
            const userPrompt = '请根据图片中的参考答案生成结构化评分细则 JSON。';

            // 使用参考答案图片或试题图片
            const imageToUse = answerImageBase64 || questionImageBase64 || '';

            const result = await callAI(systemPrompt, userPrompt, imageToUse, { jsonMode: true });

            // 解析 AI 返回的 JSON
            const cleaned = cleanJsonString(result);
            return parseRubricJSON(JSON.parse(cleaned));
        } catch (error) {
            console.error('[generateRubricFromImages] Frontend direct failed:', error);
            throw new Error(`生成评分细则失败：${error instanceof Error ? error.message : 'AI 服务不可用'} `);
        }
    }
}


/**
 * 从答题卡自动生成评分细则
 */
export async function autoGenerateRubric(
    answerSheetImageBase64: string,
    questionId?: string
): Promise<RubricJSON> {
    console.log('[autoGenerateRubric] Using backend proxy, JSON output');
    return generateRubricFromImages(null, answerSheetImageBase64, questionId);
}

/**
 * 从文本参考答案生成评分细则
 * @param answerText 文本格式的参考答案
 * @param questionId 题目 ID
 */
export async function generateRubricFromText(
    answerText: string,
    questionId?: string
): Promise<RubricJSON> {
    if (!answerText || answerText.trim().length === 0) {
        throw new Error('参考答案文本不能为空');
    }

    console.log('[generateRubricFromText] Generating rubric from text');

    // 动态导入以避免循环依赖
    const { isProxyMode } = await import('./proxyService');
    const useProxy = isProxyMode();

    console.log('[generateRubricFromText] Mode:', useProxy ? 'Backend Proxy' : 'Frontend Direct');

    if (useProxy) {
        // 后端代理模式
        try {
            const response = await fetch(`${BACKEND_URL} /api/ai / rubric / generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': getDeviceId(),
                },
                body: JSON.stringify({
                    answerText: answerText,
                    questionId: questionId || 'unknown',
                    outputFormat: 'json',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status} `);
            }

            const data = await response.json();
            const rubricData = data.rubric || data.data?.rubric || data;

            if (typeof rubricData === 'string') {
                const cleaned = cleanJsonString(rubricData);
                return parseRubricJSON(JSON.parse(cleaned));
            }

            return parseRubricJSON(rubricData);
        } catch (error) {
            console.error('[generateRubricFromText] Backend proxy failed:', error);
            // 回退到前端直连模式
            console.log('[generateRubricFromText] Falling back to frontend direct mode');
        }
    }

    // 前端直连模式
    try {
        const { callAI } = await import('./ai-router');

        const systemPrompt = getRubricSystemPrompt();
        const userPrompt = `请根据以下文本格式的参考答案生成结构化评分细则 JSON：

【参考答案】
${answerText}

【题目 ID】${questionId || '未知'}

    请仔细分析参考答案的结构，识别各小题的题型（填空题 / 半开放题 / 开放题），并生成对应的评分细则。`;

        const result = await callAI(systemPrompt, userPrompt, undefined, { jsonMode: true });
        const cleaned = cleanJsonString(result);
        return parseRubricJSON(JSON.parse(cleaned));
    } catch (error) {
        console.error('[generateRubricFromText] Frontend direct failed:', error);
        throw new Error(`生成评分细则失败：${error instanceof Error ? error.message : 'AI 服务不可用'} `);
    }
}


/**
 * 根据用户建议优化评分细则
 */
export async function refineRubric(
    currentRubric: RubricJSON,
    suggestion: string
): Promise<RubricJSON> {
    // 动态导入以避免循环依赖
    const { isProxyMode } = await import('./proxyService');
    const useProxy = isProxyMode();

    console.log('[refineRubric] Mode:', useProxy ? 'Backend Proxy' : 'Frontend Direct');

    if (useProxy) {
        // 后端代理模式
        try {
            const response = await fetch(`${BACKEND_URL} /api/ai / rubric / refine`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': getDeviceId(),
                },
                body: JSON.stringify({
                    currentRubric,
                    suggestion,
                    outputFormat: 'json',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status} `);
            }

            const data = await response.json();
            const rubricData = data.rubric || data.data?.rubric || data;

            if (typeof rubricData === 'string') {
                const cleaned = cleanJsonString(rubricData);
                return parseRubricJSON(JSON.parse(cleaned));
            }

            return parseRubricJSON(rubricData);
        } catch (error) {
            console.error('[refineRubric] Backend proxy failed:', error);
            throw new Error(`优化评分细则失败：${error instanceof Error ? error.message : '后端服务不可用'} `);
        }
    } else {
        // 前端直连模式
        try {
            const { callAI } = await import('./ai-router');

            const systemPrompt = `你是一位资深阅卷专家。请根据用户的修改建议，优化现有的评分细则 JSON。
    输出要求：直接输出优化后的完整 JSON（不要包裹在代码块中），保持与原始结构一致。`;

            const userPrompt = `【当前评分细则】
${JSON.stringify(currentRubric, null, 2)}

【用户修改建议】
${suggestion}

    请根据建议优化评分细则，输出完整的新 JSON。`;

            const result = await callAI(systemPrompt, userPrompt, undefined, { jsonMode: true });
            const cleaned = cleanJsonString(result);
            return parseRubricJSON(JSON.parse(cleaned));
        } catch (error) {
            console.error('[refineRubric] Frontend direct failed:', error);
            throw new Error(`优化评分细则失败：${error instanceof Error ? error.message : 'AI 服务不可用'} `);
        }
    }
}


// ==================== 工具函数 ====================

/**
 * 清理 AI 返回的 JSON 字符串
 */
function cleanJsonString(str: string): string {
    let result = str.trim();

    // 移除代码块标记
    result = result.replace(/^```json\s */i, '');
    result = result.replace(/^```\s*/i, '');
    result = result.replace(/\s*```$/i, '');

    // 尝试提取 JSON 对象
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        result = jsonMatch[0];
    }

    return result;
}

/**
 * 验证 RubricJSON 格式是否正确
 */
export function validateRubric(rubric: RubricJSON): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (rubric.version !== '2.0') {
        errors.push('版本号必须是 2.0');
    }

    if (!rubric.questionId) {
        errors.push('缺少题目 ID');
    }

    if (!rubric.title) {
        errors.push('缺少题目标题');
    }

    if (rubric.totalScore <= 0) {
        errors.push('总分必须大于 0');
    }

    if (!rubric.answerPoints || rubric.answerPoints.length === 0) {
        errors.push('至少需要一个得分点');
    }

    for (const point of rubric.answerPoints) {
        if (!point.id) {
            errors.push('得分点缺少 ID');
        }
        if (!point.content) {
            errors.push(`得分点 ${point.id} 缺少内容`);
        }
        if (point.score <= 0) {
            errors.push(`得分点 ${point.id} 分值必须大于 0`);
        }
    }

    return { valid: errors.length === 0, errors };
}
