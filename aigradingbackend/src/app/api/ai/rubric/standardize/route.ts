/**
 * AI 评分细则格式化 API
 * 使用 GPTsAPI 将评分细则标准化为统一格式
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';
import { generateRubricWithZhipu } from '@/lib/zhipu';

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
 * 调用 GPTsAPI 进行格式化
 */
async function callGPTsAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(GPTSAPI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GPTSAPI_KEY}`
        },
        body: JSON.stringify({
            model: GPTSAPI_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 4096
        })
    });

    if (!response.ok) {
        throw new Error(`API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * POST /api/ai/rubric/standardize
 * 格式化评分细则
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rubric, maxScore } = body;

        if (!rubric || typeof rubric !== 'string' || !rubric.trim()) {
            return apiError('请提供评分细则内容');
        }

        let userPrompt = `请将以下评分细则转换为标准格式：\n\n${rubric}`;
        if (maxScore) {
            userPrompt += `\n\n注意：此题满分为 ${maxScore} 分，请确保分值分配正确。`;
        }

        let result = '';

        // 尝试 GPTSAPI (中转代理)
        try {
            if (!GPTSAPI_KEY) throw new Error('GPTSAPI_KEY not configured');
            result = await callGPTsAPI(STANDARDIZE_PROMPT, userPrompt);
            console.log('[Standardize API] Success with GPTsAPI');
        } catch (err) {
            console.warn('[Standardize API] GPTSAPI failed, trying Zhipu direct');
            try {
                // 回退到智谱 (国产直连)
                result = await generateRubricWithZhipu(STANDARDIZE_PROMPT, userPrompt, []);
                console.log('[Standardize API] Success with Zhipu GLM-4.7');
            } catch (zhipuErr) {
                console.error('[Standardize API] All providers failed');
                return apiServerError('AI 服务暂时不可用');
            }
        }

        if (!result) {
            return apiServerError('AI 未返回有效内容');
        }

        // 后处理：移除 Markdown 代码块标记
        result = result.replace(/```markdown\n?/gi, '');
        result = result.replace(/```\n?/g, '');

        console.log('[Standardize API] Standardized successfully');
        return apiSuccess({ rubric: result }, '格式化成功');

    } catch (error) {
        console.error('[Standardize API] Error:', error);
        return apiServerError('格式化失败');
    }
}
