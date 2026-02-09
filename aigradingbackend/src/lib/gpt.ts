/**
 * GPT AI API 封装 (GPT-4o)
 * 使用 OpenAI 格式调用 GPTSAPI 或其他 OpenAI 兼容服务
 */

import { RubricJSONV3 } from './rubric-v3';
import { buildJudgePrompt, parseJudgeResult, JudgeResult } from './rubric-judge';
// 从环境变量读取配置
const GPT_API_URL = process.env.GPT_API_URL || 'https://api.gptsapi.net/v1/chat/completions';
const GPT_API_KEY = process.env.GPT_API_KEY || '';

// 策略与模型绑定配置
const STRATEGY_MODEL_MAP: Record<string, { model: string; timeout: number; description: string }> = {
    // 快速模式：使用 GPT-4o
    flash: {
        model: process.env.GPT_MODEL_FLASH || 'gpt-4o',
        timeout: 20000,
        description: '快速模式 (GPT-4o) - 智能且快速'
    },
    // 精准模式：使用 GPT-4o
    pro: {
        model: process.env.GPT_MODEL_PRO || 'gpt-4o',
        timeout: 40000,
        description: '精准模式 (GPT-4o) - 高质量批改'
    },
    // 深度推理模式：使用 GPT-4o
    reasoning: {
        model: process.env.GPT_MODEL_REASONING || 'gpt-4o',
        timeout: 60000,
        description: '深度模式 (GPT-4o) - 深度分析'
    }
};

// 默认策略
const DEFAULT_STRATEGY = 'flash';

export type GradingStrategy = 'flash' | 'pro' | 'reasoning';

export interface GradeRequest {
    imageBase64: string;  // 学生答案图片
    rubric: string;       // 评分细则
    studentName?: string; // 学生姓名
    questionNo?: string;  // 题号
    strategy?: GradingStrategy; // 策略参数
}

export interface GradeResult {
    score: number;
    maxScore: number;
    comment: string;
    breakdown: {
        label: string;
        score: number;
        max: number;
        comment?: string;
        isNegative?: boolean;
    }[];
}

export interface JudgeRequest {
    imageBase64: string;
    rubric: RubricJSONV3;
    studentName?: string;
}

// 批改 Prompt 模板 - 支持 JSON 结构化评分细则
function buildGradingPrompt(rubric: string, studentName?: string): string {
    // 检测是否为 JSON 格式的评分细则
    const isJSONRubric = rubric.trim().startsWith('{')
        || rubric.includes('"strategyType"')
        || rubric.includes('"version":"3.0"')
        || rubric.includes('"version": "3.0"');

    if (isJSONRubric) {
        // JSON 结构化评分模式 - 逐点精准匹配
        return `你是一位高效的阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubric}

${studentName ? `【学生姓名】：${studentName}` : ''}

【评分规则】
1. 逐一检查评分细则中的每个得分项（points/steps/dimensions），并在 breakdown 中回复对应编号 ID。
2. 根据 keywords 关键词匹配学生答案（允许同义表述）。
3. **填空题严格模式**（重要）：
   - 如果评分细则中指明是“填空题”（题目标题或阅卷提示中包含“填空”字样），且 **strictMode 为 true**：
     - **必须完全匹配参考答案**，任何错别字、漏字、多字或同义词均不得分。
4. 根据 scoringStrategy 计算最终得分：
   - pick_n: 最多计算 maxPoints 个得分点
   - all: 全部答对才得满分
   - weighted: 按各点分值计分
5. 如果 allowAlternative 为 true，接受言之成理的等效答案。
6. 参考 constraints 中的阅卷提示进行评分。

【输出格式】
返回 JSON，breakdown 必须包含每个得分点的评分信息：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 编号 | 得分 | 理由 |\\n|---|---|---|\\n| 2-1 | 2/2 | ✓ 符合答案要求 |\\n| 2-2 | 0/2 | ✗ 未提及边疆危机 |",
  "breakdown": [
    {
      "label": "2-1 破坏了中国的领土主权",
      "pointId": "2-1",
      "score": 2,
      "max": 2,
      "comment": "✓ 答对"
    },
    {
      "label": "2-2 加剧了中国边疆危机",
      "pointId": "2-2",
      "score": 0,
      "max": 2,
      "comment": "✗ 未提及"
    }
  ],
  "matchedCount": 3
}

【breakdown 字段要求】
- label: 得分点编号 + 参考答案内容
- pointId: 评分细则中对应的得分点原始 ID
- score: 该点实得分
- max: 该点满分
- comment: 简洁评分理由：
  - 得分时：✓ + 简短说明
  - 扣分时：✗ + 简短说明（如果是填空题严格模式未完全匹配，说明“填空题不完全匹配”）

注意：评语要简洁，只说明得分或扣分原因，不要引用学生答案原文！`;
    } else {
        // 兼容旧版 Markdown 格式评分细则
        return `你是一位高效的阅卷专家。请根据【评分细则】对【学生答案】进行快速评分。

【评分细则】
${rubric}

${studentName ? `【学生姓名】：${studentName}` : ''}

【评分要求】
1. 快速判断得分，评语简洁明了。
2. comment 字段使用 Markdown 表格格式，包含小题号、得分和理由。

返回 JSON 格式：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 题号 | 得分 | 理由 |\\n|---|---|---|\\n| (1) | 4/4 | 回答正确 |\\n| (2) | 2/4 | 缺少XXX |",
  "breakdown": []
}

注意：comment 必须是 Markdown 表格字符串，breakdown 返回空数组即可。`;
    }
}

/**
 * 使用指定模型调用 GPT API
 */
async function callGPTAPI(model: string, prompt: string, imageBase64: string, timeoutMs?: number): Promise<string> {
    const requestBody = {
        model,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`
                        }
                    }
                ]
            }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
    };

    const controller = timeoutMs ? new AbortController() : undefined;
    const timeoutId = timeoutMs && controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
        const response = await fetch(GPT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GPT_API_KEY}`
            },
            body: JSON.stringify(requestBody),
            signal: controller?.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API 调用失败 (${response.status}): ${error.substring(0, 100)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('API 返回内容为空');
        }

        return content;
    } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`模型 ${model} 超时 (${timeoutMs}ms)`);
        }
        throw error;
    }
}

/**
 * 解析 GPT 返回的 JSON 评分结果
 */
function parseGradeResult(content: string): GradeResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('无法解析评分结果');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
        score: Number(parsed.score) || 0,
        maxScore: Number(parsed.maxScore) || 10,
        comment: parsed.comment || '评分完成',
        breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : []
    };
}

/**
 * 获取策略对应的模型配置
 */
function getStrategyConfig(strategy: GradingStrategy = DEFAULT_STRATEGY) {
    return STRATEGY_MODEL_MAP[strategy] || STRATEGY_MODEL_MAP[DEFAULT_STRATEGY];
}

/**
 * 调用 GPT API 进行批改（策略驱动模型选择）
 * 
 * @param request - 批改请求
 * @param strategy - 阅卷策略 ('flash' | 'pro' | 'reasoning')
 * 
 * 当主模型超时时，自动回退到下一级模型
 */
export async function gradeWithGPT(
    request: GradeRequest,
    strategy: GradingStrategy = 'pro'
): Promise<GradeResult & { model?: string; strategy?: string }> {
    if (!GPT_API_KEY) {
        throw new Error('GPT API Key 未配置');
    }

    const prompt = buildGradingPrompt(request.rubric, request.studentName);
    const imageBase64 = request.imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // 获取策略配置
    const config = getStrategyConfig(strategy);
    console.log(`[GPT] 策略: ${strategy}, 模型: ${config.model}, 超时: ${config.timeout}ms`);

    // 尝试使用策略对应的模型
    try {
        const startTime = Date.now();
        const content = await callGPTAPI(config.model, prompt, imageBase64, config.timeout);
        const elapsed = Date.now() - startTime;
        console.log(`[GPT] ${strategy} 模式响应成功，耗时: ${elapsed}ms`);

        const result = parseGradeResult(content);
        return { ...result, model: config.model, strategy };
    } catch (primaryError: any) {
        console.warn(`[GPT] ${strategy} 模式失败: ${primaryError.message}`);

        // 回退策略：flash 失败 → pro，pro 失败 → reasoning
        const fallbackOrder: Record<string, GradingStrategy | null> = {
            flash: 'pro',
            pro: 'reasoning',
            reasoning: null  // reasoning 失败则直接报错
        };

        const fallbackStrategy = fallbackOrder[strategy];
        if (!fallbackStrategy) {
            throw primaryError;  // 无回退选项，抛出错误
        }

        // 使用回退策略
        console.log(`[GPT] 回退到 ${fallbackStrategy} 模式`);
        const fallbackConfig = getStrategyConfig(fallbackStrategy);

        try {
            const startTime = Date.now();
            const content = await callGPTAPI(fallbackConfig.model, prompt, imageBase64, fallbackConfig.timeout);
            const elapsed = Date.now() - startTime;
            console.log(`[GPT] ${fallbackStrategy} 模式（回退）响应成功，耗时: ${elapsed}ms`);

            const result = parseGradeResult(content);
            return { ...result, model: fallbackConfig.model, strategy: fallbackStrategy };
        } catch (fallbackError: any) {
            console.error(`[GPT] 回退模式也失败: ${fallbackError.message}`);
            throw fallbackError;
        }
    }
}

/**
 * 使用 GPT 进行评分判定（仅输出判定 JSON）
 */
export async function judgeWithGPT(
    request: JudgeRequest,
    strategy: GradingStrategy = 'pro'
): Promise<{ judge: JudgeResult; model?: string; strategy?: string }> {
    if (!GPT_API_KEY) {
        throw new Error('GPT API Key 未配置');
    }

    const prompt = buildJudgePrompt(request.rubric);
    const imageBase64 = request.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const config = getStrategyConfig(strategy);

    try {
        const content = await callGPTAPI(config.model, prompt, imageBase64, config.timeout);
        const judge = parseJudgeResult(content);
        return { judge, model: config.model, strategy };
    } catch (error: any) {
        console.error(`[GPT] Judge failed: ${error.message}`);
        throw error;
    }
}

/**
 * 获取可用策略列表（供前端使用）
 */
export function getAvailableStrategies() {
    return Object.entries(STRATEGY_MODEL_MAP).map(([key, config]) => ({
        key,
        model: config.model,
        description: config.description
    }));
}
