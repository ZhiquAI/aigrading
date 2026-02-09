/**
 * AI 评分细则生成 API（仅输出 RubricJSON v3）
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiServerError, ErrorCode } from '@/lib/api-response';
import { validateRubricV3, RubricJSONV3 } from '@/lib/rubric-v3';
import { getRubricSystemPrompt } from '@/lib/config-service';
import { generateRubricWithZhipu } from '@/lib/zhipu';

const GPTSAPI_URL = 'https://api.gptsapi.net/v1/chat/completions';
const GPTSAPI_KEY = process.env.GPTSAPI_KEY || '';
const GPTSAPI_MODEL = process.env.GPTSAPI_MODEL || 'gpt-4o';
const GPTSAPI_MODEL_FALLBACK = process.env.GPTSAPI_MODEL_FALLBACK || 'gpt-4o';

/**
 * 调用 GPTsAPI
 */
async function callGPTsAPI(
    systemPrompt: string,
    userPrompt: string,
    images: { base64: string; label?: string }[],
    model: string
): Promise<string> {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: userPrompt }
    ];

    // 添加图片(如果有)
    for (const img of images) {
        if (img.label) {
            content.push({ type: 'text', text: img.label });
        }
        const imageUrl = img.base64.startsWith('data:')
            ? img.base64
            : `data:image/jpeg;base64,${img.base64}`;
        content.push({ type: 'image_url', image_url: { url: imageUrl } });
    }

    const response = await fetch(GPTSAPI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GPTSAPI_KEY}`
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
            ],
            temperature: 0.2,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        throw new Error(`API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 解析并验证 JSON
 */
function parseAndValidate(jsonString: string): RubricJSONV3 {
    // 提取 JSON
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('未找到有效的 JSON 内容');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 添加时间戳
    const now = new Date().toISOString();
    parsed.createdAt = now;
    parsed.updatedAt = now;

    // 验证（严格 v3）
    const validation = validateRubricV3(parsed);
    if (!validation.valid) {
        throw new Error(`格式错误: ${validation.errors.join(', ')}`);
    }
    return validation.rubric!;
}

/**
 * POST /api/ai/rubric
 * 生成评分细则(支持图片和文本)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            questionImage,
            answerImage,
            answerText,
            questionId,
            subject,
            questionType,
            strategyType,
            examName
        } = body;

        if (!questionImage && !answerImage && !answerText) {
            return apiError('请提供图片或文本参考答案');
        }

        // 统一使用配置服务生成 system prompt
        const systemPrompt = getRubricSystemPrompt();
        const contextLines = [
            subject ? `学科：${subject}` : '',
            questionType ? `题型：${questionType}` : '',
            strategyType ? `建议评分结构：${strategyType}` : '',
            examName ? `考试：${examName}` : '',
            questionId ? `题号：${questionId}` : ''
        ].filter(Boolean);
        const contextPrompt = contextLines.length > 0 ? `【上下文】\n${contextLines.join('\n')}\n\n` : '';

        let userPrompt: string;
        let images: { base64: string; label?: string }[] = [];

        if (answerText) {
            // 文本模式
            userPrompt = `${contextPrompt}请根据以下文本格式的参考答案生成结构化评分细则 JSON:

【参考答案】
${answerText}

【题目 ID】${questionId || '未知'}

请仔细分析参考答案的结构,识别各小题的题型(客观题/材料分析题/开放性题目),并生成对应的评分细则。`;
            console.log('[Rubric AI] Mode: Text input');
        } else {
            // 图片模式
            userPrompt = `${contextPrompt}请根据图片中的参考答案生成结构化评分细则 JSON。`;
            if (questionImage) {
                images.push({ base64: questionImage, label: '【试题图片】' });
            }
            if (answerImage) {
                images.push({ base64: answerImage, label: '【参考答案图片】' });
            }
            console.log('[Rubric AI] Mode: Image input');
        }

        let jsonContent: string;
        let provider = 'gptsapi';

        // 尝试主选模型 (GPTSAPI)
        try {
            if (!GPTSAPI_KEY) throw new Error('GPTSAPI_KEY not configured');
            jsonContent = await callGPTsAPI(systemPrompt, userPrompt, images, GPTSAPI_MODEL);
            console.log(`[Rubric AI] Success with: ${GPTSAPI_MODEL}`);
        } catch (primaryError) {
            console.warn(`[Rubric AI] Primary failed, trying fallback`);
            try {
                if (GPTSAPI_KEY) {
                    jsonContent = await callGPTsAPI(systemPrompt, userPrompt, images, GPTSAPI_MODEL_FALLBACK);
                } else {
                    throw new Error('Fallback to Zhipu direct');
                }
            } catch (fallbackError) {
                console.warn(`[Rubric AI] Fallback failed, trying Zhipu direct`);
                try {
                    // 回退到智谱 GLM-4.7 (国产直连，不依赖中转代理)
                    jsonContent = await generateRubricWithZhipu(systemPrompt, userPrompt, images);
                    provider = 'zhipu';
                    console.log(`[Rubric AI] Success with Zhipu GLM-4.7`);
                } catch (zhipuError: any) {
                    console.error(`[Rubric AI] All providers failed:`, zhipuError.message);
                    return apiServerError('AI 服务暂时不可用,请稍后重试');
                }
            }
        }

        // 解析并验证
        const rubric = parseAndValidate(jsonContent);

        // 如果提供了 questionId,覆盖
        if (questionId) {
            rubric.metadata.questionId = questionId;
        }
        if (subject) {
            rubric.metadata.subject = subject;
        }
        if (questionType) {
            rubric.metadata.questionType = questionType;
        }
        if (examName) {
            rubric.metadata.examName = examName;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = rubric.content as any;
        const pointCount = rubric.strategyType === 'rubric_matrix'
            ? content.dimensions?.length ?? 0
            : rubric.strategyType === 'sequential_logic'
                ? content.steps?.length ?? 0
                : content.points?.length ?? 0;

        console.log(`[Rubric AI] Generated: ${rubric.metadata.questionId}, ${pointCount} points`);

        return apiSuccess({
            rubric,
            provider
        }, '评分细则生成成功');

    } catch (error) {
        console.error('[Rubric AI] Error:', error);
        if (error instanceof Error) {
            return apiError(error.message, 400, ErrorCode.RUBRIC_FORMAT_INVALID);
        }
        return apiServerError('评分细则生成失败');
    }
}
