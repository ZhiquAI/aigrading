/**
 * AI 评分细则格式化 API
 * 使用 GPTsAPI 将评分细则标准化为统一格式
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

const GPTSAPI_URL = 'https://api.gptsapi.net/v1/chat/completions';
const GPTSAPI_KEY = process.env.GPTSAPI_KEY || '';
const GPTSAPI_MODEL = process.env.GPTSAPI_MODEL || 'gpt-4o';

const STANDARDIZE_PROMPT = `你是一位评分细则格式化专家。请将给定的评分细则转换为标准的 Markdown 格式。

标准格式要求：
1. 首行必须是 "## 总分: X分"
2. 使用表格展示各得分点
3. 表格列：分值 | 给分标准 | 常见错误及扣分
4. 保留所有原有信息
5. 确保分值总和等于总分

输出纯Markdown文本，不要包裹代码块。`;

/**
 * POST /api/ai/rubric/standardize
 * 格式化评分细则
 */
export async function POST(request: NextRequest) {
    try {
        if (!GPTSAPI_KEY) {
            return apiError('服务未配置 API Key', 500);
        }

        const body = await request.json();
        const { rubric, maxScore } = body;

        if (!rubric || typeof rubric !== 'string' || !rubric.trim()) {
            return apiError('请提供评分细则内容');
        }

        let userPrompt = `请将以下评分细则转换为标准格式：

${rubric}`;

        if (maxScore) {
            userPrompt += `\n\n注意：此题满分为 ${maxScore} 分，请确保分值分配正确。`;
        }

        const requestBody = {
            model: GPTSAPI_MODEL,
            messages: [
                { role: 'system', content: STANDARDIZE_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4096
        };

        console.log('[Standardize API] Calling GPTsAPI...');

        const response = await fetch(GPTSAPI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GPTSAPI_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Standardize API] GPTsAPI error:', errorText);
            return apiServerError('AI 服务调用失败');
        }

        const data = await response.json();
        let result = data.choices?.[0]?.message?.content || '';

        if (!result) {
            return apiServerError('AI 未返回有效内容');
        }

        // 后处理：移除 Markdown 代码块标记
        result = result.replace(/```markdown\n?/gi, '');
        result = result.replace(/```\n?/g, '');

        console.log('[Standardize API] Success, result length:', result.length);
        return apiSuccess({ rubric: result }, '格式化成功');

    } catch (error) {
        console.error('[Standardize API] Error:', error);
        return apiServerError('格式化失败');
    }
}
