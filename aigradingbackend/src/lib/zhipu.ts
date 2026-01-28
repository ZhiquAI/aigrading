/**
 * 智谱 AI API 封装
 * 使用 GLM-4V-Flash 进行图片批改
 */

import crypto from 'crypto';

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '';

/**
 * 生成智谱 API 的 JWT Token
 * API Key 格式: {id}.{secret}
 */
function generateZhipuToken(): string {
    if (!ZHIPU_API_KEY || !ZHIPU_API_KEY.includes('.')) {
        throw new Error('智谱 API Key 未配置，应为 {id}.{secret}');
    }

    const [apiKeyId, apiKeySecret] = ZHIPU_API_KEY.split('.');

    // JWT Header
    const header = {
        alg: 'HS256',
        sign_type: 'SIGN'
    };

    // JWT Payload
    const now = Date.now();
    const payload = {
        api_key: apiKeyId,
        exp: now + 3600 * 1000, // 1 小时后过期
        timestamp: now
    };

    // Base64URL 编码
    const base64UrlEncode = (obj: object) => {
        return Buffer.from(JSON.stringify(obj))
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);

    // 签名
    const signature = crypto
        .createHmac('sha256', apiKeySecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${headerB64}.${payloadB64}.${signature}`;
}

export interface GradeRequest {
    imageBase64: string;  // 学生答案图片
    rubric: string;       // 评分细则
    studentName?: string; // 学生姓名
    questionNo?: string;  // 题号
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
    }[];
}

// 批改 Prompt 模板 - 支持 JSON 结构化评分细则（与 GPT-4o 同步）
function buildGradingPrompt(rubric: string, studentName?: string): string {
    // 检测是否为 JSON 格式的评分细则
    const isJSONRubric = rubric.trim().startsWith('{') || rubric.includes('"answerPoints"');

    if (isJSONRubric) {
        // JSON 结构化评分模式 - 逐点精准匹配
        return `你是一位高效的阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubric}

${studentName ? `【学生姓名】：${studentName}` : ''}

【评分规则】
1. 逐一检查 answerPoints 中的每个得分点，并在 breakdown 中回复对应的编号 ID。
2. 根据 keywords 关键词匹配学生答案（允许同义表述）。
3. **填空题严格模式**（重要）：
   - 如果评分细则中指明是“填空题”（题目标题或阅卷提示中包含“填空”字样），且 **strictMode 为 true**：
     - **必须完全匹配参考答案**，任何错别字、漏字、多字或同义词均不得分。
4. 根据 scoringStrategy 计算最终得分：
   - pick_n: 最多计算 maxPoints 个得分点
   - all: 全部答对才得满分
   - weighted: 按各点分值计分
5. 参考 gradingNotes 中的阅卷提示进行评分。

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
    }

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

// 解析 AI 返回的 JSON
function parseGradeResult(content: string): GradeResult {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('无法解析评分结果');
    }

    try {
        const result = JSON.parse(jsonMatch[0]);
        return {
            score: Number(result.score) || 0,
            maxScore: Number(result.maxScore) || 10,
            comment: result.comment || '评分完成',
            breakdown: Array.isArray(result.breakdown) ? result.breakdown : []
        };
    } catch (e) {
        throw new Error('评分结果格式错误');
    }
}

/**
 * 调用智谱 API 进行评分细则生成
 */
export async function generateRubricWithZhipu(
    systemPrompt: string,
    userPrompt: string,
    images: { base64: string; label?: string }[]
): Promise<string> {
    if (!ZHIPU_API_KEY) {
        throw new Error('智谱 API Key 未配置');
    }

    const content: any[] = [{ type: 'text', text: userPrompt }];

    for (const img of images) {
        if (img.label) {
            content.push({ type: 'text', text: img.label });
        }
        content.push({
            type: 'image_url',
            image_url: {
                url: img.base64.startsWith('data:')
                    ? img.base64
                    : `data:image/jpeg;base64,${img.base64}`
            }
        });
    }

    const requestBody = {
        model: 'glm-4.7', // 优先使用 4.7
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content }
        ],
        temperature: 0.2,
        max_tokens: 4096
    };

    try {
        const token = generateZhipuToken();
        const response = await fetch(ZHIPU_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`智谱 API 调用失败: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('Zhipu rubric generation error:', error);
        throw error;
    }
}

/**
 * 调用智谱 API 进行批改
 */
export async function gradeWithZhipu(request: GradeRequest): Promise<GradeResult> {
    if (!ZHIPU_API_KEY) {
        throw new Error('智谱 API Key 未配置');
    }

    const prompt = buildGradingPrompt(request.rubric, request.studentName);

    // 构建请求体
    const requestBody = {
        model: 'glm-4.7', // 升级到 4.7
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: request.imageBase64.startsWith('data:')
                                ? request.imageBase64
                                : `data:image/jpeg;base64,${request.imageBase64}`
                        }
                    }
                ]
            }
        ],
        temperature: 0.1,
        max_tokens: 1024
    };

    try {
        const token = generateZhipuToken();
        const response = await fetch(ZHIPU_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Zhipu API error:', error);
            throw new Error(`智谱 API 调用失败: ${response.status}`);
        }

        const data = await response.json();

        // 打印完整响应以便调试
        console.log('[Zhipu Debug] Full Response:', JSON.stringify(data, null, 2));

        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error('[Zhipu Error] Response structure:', Object.keys(data));
            if (data.choices?.[0]?.finish_reason) {
                console.error('[Zhipu Error] Finish reason:', data.choices[0].finish_reason);
            }
            throw new Error('智谱 API 返回内容为空');
        }

        return parseGradeResult(content);

    } catch (error) {
        console.error('Zhipu grading error:', error);
        throw error;
    }
}
