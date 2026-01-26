/**
 * Gemini AI 直连服务
 * 直接调用 Google Gemini API，跳过中转代理
 * 
 * 优势：
 * - 延迟更低（少一层代理）
 * - 成本更低（无中转费用）
 * - 支持最新模型
 */

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 模型配置
const GEMINI_MODELS = {
    flash: 'gemini-1.5-flash',      // 稳定且快速
    pro: 'gemini-1.5-pro',          // 平衡质量
    reasoning: 'gemini-2.0-flash'   // 尝试使用 2.0 处理复杂任务
};

export type GradingStrategy = 'flash' | 'pro' | 'reasoning';

export interface GradeRequest {
    imageBase64: string;
    rubric: string;
    studentName?: string;
    questionNo?: string;
    strategy?: GradingStrategy;
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

/**
 * 构建批改 Prompt
 */
function buildGradingPrompt(rubric: string, studentName?: string): string {
    const isJSONRubric = rubric.trim().startsWith('{') || rubric.includes('"answerPoints"');

    if (isJSONRubric) {
        return `你是一位高效的阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubric}

${studentName ? `【学生姓名】：${studentName}` : ''}

【评分规则】
1. 逐一检查 answerPoints 中的每个得分点，并在 breakdown 中回复对应的编号 ID。
2. 根据 keywords 关键词匹配学生答案（允许同义表述）。
3. **填空题严格模式**：如果 strictMode 为 true，必须完全匹配参考答案。
4. 根据 scoringStrategy 计算最终得分。
5. 参考 gradingNotes 中的阅卷提示进行评分。

【输出格式】
返回 JSON：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 编号 | 得分 | 理由 |\\n|---|---|---|\\n| 2-1 | 2/2 | ✓ 符合答案要求 |",
  "breakdown": [
    {"label": "2-1 得分点内容", "pointId": "2-1", "score": 2, "max": 2, "comment": "✓ 答对"}
  ]
}

注意：评语简洁，不要引用学生答案原文！`;
    }

    return `你是一位高效的阅卷专家。请根据【评分细则】对【学生答案】进行快速评分。

【评分细则】
${rubric}

${studentName ? `【学生姓名】：${studentName}` : ''}

【评分要求】
1. 快速判断得分，评语简洁明了。
2. comment 字段使用 Markdown 表格格式。

返回 JSON 格式：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 题号 | 得分 | 理由 |\\n|---|---|---|\\n| (1) | 4/4 | 回答正确 |",
  "breakdown": []
}`;
}

/**
 * 调用 Gemini API
 */
async function callGeminiAPI(
    model: string,
    prompt: string,
    imageBase64: string,
    timeoutMs: number = 30000
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 清理 base64 前缀
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: cleanBase64
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
        }
    };

    try {
        const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const startTime = Date.now();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const error = await response.text();
            console.error(`[Gemini] API error (${response.status}):`, error.substring(0, 200));
            throw new Error(`Gemini API 调用失败 (${response.status})`);
        }

        const data = await response.json();
        console.log(`[Gemini] ${model} 响应成功，耗时: ${elapsed}ms`);

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            console.error('[Gemini] 响应结构异常:', JSON.stringify(data).substring(0, 200));
            throw new Error('Gemini API 返回内容为空');
        }

        return content;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Gemini 超时 (${timeoutMs}ms)`);
        }
        throw error;
    }
}

/**
 * 解析评分结果
 */
function parseGradeResult(content: string): GradeResult {
    // 清理可能的 markdown 代码块
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/, '');
        cleanContent = cleanContent.replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
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
 * 使用 Gemini 直连进行批改
 */
export async function gradeWithGemini(
    request: GradeRequest,
    strategy: GradingStrategy = 'flash'
): Promise<GradeResult & { model?: string; strategy?: string }> {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API Key 未配置');
    }

    const model = GEMINI_MODELS[strategy] || GEMINI_MODELS.flash;
    const timeout = strategy === 'reasoning' ? 60000 : 30000;

    console.log(`[Gemini] 策略: ${strategy}, 模型: ${model}, 超时: ${timeout}ms`);

    const prompt = buildGradingPrompt(request.rubric, request.studentName);

    try {
        const content = await callGeminiAPI(model, prompt, request.imageBase64, timeout);
        const result = parseGradeResult(content);
        return { ...result, model, strategy };
    } catch (error: any) {
        console.error(`[Gemini] ${strategy} 模式失败:`, error.message);
        throw error;
    }
}

/**
 * 检查 Gemini 服务是否可用
 */
export function isGeminiAvailable(): boolean {
    return !!GEMINI_API_KEY;
}
