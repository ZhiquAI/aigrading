/**
 * grading-service.ts - 批改服务
 * 
 * 负责学生答案的批改和评分
 * 从 geminiService.ts 拆分
 */

import { GoogleGenAI, Type } from '@google/genai';
import { StudentResult, AppConfig } from '../types';
import { getAppConfig } from './config-service';
import { getGoogleClient, callOpenAICompatible } from './ai-service';

// ==================== 类型定义 ====================

export type GradingStrategy = 'flash' | 'pro' | 'reasoning';

// ==================== 策略模型映射 ====================

const STRATEGY_MODELS: Record<GradingStrategy, string> = {
    flash: 'gemini-2.0-flash-exp',
    pro: 'gemini-2.0-pro-exp',
    reasoning: 'gemini-2.5-flash-preview-05-20'
};

/**
 * 根据策略获取模型名称
 */
export function getModelName(strategy: GradingStrategy = 'flash', config: AppConfig): string {
    if (config.provider !== 'google') {
        return config.modelName;
    }
    return STRATEGY_MODELS[strategy] || config.modelName;
}

// ==================== 批改系统提示词 ====================

const GRADING_SYSTEM_PROMPT = `你是一位专业的阅卷老师，请根据评分细则严格批改学生的答题内容。

请按以下 JSON 格式输出评分结果：
{
  "score": <得分>,
  "maxScore": <满分>,
  "comment": "<总体评语>",
  "breakdown": [
    {
      "label": "<得分点名称>",
      "score": <该点得分>,
      "max": <该点满分>,
      "comment": "<具体评语>"
    }
  ]
}

注意：
1. 严格按照评分细则给分
2. 每个得分点都要详细说明扣分原因
3. 分数必须是数字，不能是字符串
4. 确保所有得分点的分数之和等于总分`;

// ==================== 批改函数 ====================

/**
 * 批改学生答案
 */
export async function assessStudentAnswer(
    studentImageBase64: string,
    rubricText: string,
    strategy: GradingStrategy = 'flash'
): Promise<StudentResult> {
    const config = getAppConfig();
    const modelName = getModelName(strategy, config);

    const userPrompt = `请根据以下评分细则批改学生的答题内容：

【评分细则】
${rubricText}

请仔细查看学生答题图片，按照评分细则严格评分。`;

    let rawResult: string;

    if (config.provider === 'google') {
        const ai = getGoogleClient(config.apiKey);
        if (!ai) throw new Error('API Key 未配置');

        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{
                role: 'user',
                parts: [
                    { text: GRADING_SYSTEM_PROMPT },
                    { text: userPrompt },
                    { inlineData: { mimeType: 'image/jpeg', data: studentImageBase64 } }
                ]
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        maxScore: { type: Type.NUMBER },
                        comment: { type: Type.STRING },
                        breakdown: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    score: { type: Type.NUMBER },
                                    max: { type: Type.NUMBER },
                                    comment: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        rawResult = result.text || '{}';
    } else {
        rawResult = await callOpenAICompatible(
            { ...config, modelName },
            GRADING_SYSTEM_PROMPT,
            userPrompt,
            studentImageBase64,
            true // JSON 模式
        );
    }

    // 解析和标准化结果
    try {
        const parsed = JSON.parse(rawResult);
        return normalizeResult(parsed);
    } catch (e) {
        console.error('[assessStudentAnswer] Failed to parse result:', e);
        throw new Error('AI 返回的结果格式错误');
    }
}

/**
 * 直接调用前端 AI 批改学生答案（不检查代理模式）
 * 用于 proxyService 的 fallback 场景
 */
export async function assessStudentAnswerDirect(
    studentImageBase64: string,
    rubricText: string,
    studentName?: string,
    strategy: GradingStrategy = 'flash'
): Promise<StudentResult> {
    const result = await assessStudentAnswer(studentImageBase64, rubricText, strategy);

    // 填充学生名称
    return {
        ...result,
        name: studentName || '自动识别'
    };
}

/**
 * 标准化评分结果
 */
function normalizeResult(obj: Record<string, unknown>): StudentResult {
    // 处理不同格式的响应
    let score = 0;
    let maxScore = 0;
    let comment = '';
    let breakdown: Array<{ label: string; score: number; max: number; comment?: string }> = [];

    // 标准格式
    if (typeof obj.score === 'number') {
        score = obj.score;
    } else if (typeof obj.total_score === 'number') {
        score = obj.total_score;
    }

    if (typeof obj.maxScore === 'number') {
        maxScore = obj.maxScore;
    } else if (typeof obj.max_score === 'number') {
        maxScore = obj.max_score;
    }

    if (typeof obj.comment === 'string') {
        comment = obj.comment;
    } else if (typeof obj.feedback === 'string') {
        comment = obj.feedback;
    }

    // 处理 breakdown / details
    const details = obj.breakdown || obj.details || [];
    if (Array.isArray(details)) {
        breakdown = details.map((item: any) => ({
            label: item.label || item.name || item.point || '得分点',
            score: Number(item.score) || 0,
            max: Number(item.max) || Number(item.maxScore) || 0,
            comment: item.comment || item.reason || item.feedback || ''
        }));
    }

    // 如果没有 maxScore，从 breakdown 计算
    if (maxScore === 0 && breakdown.length > 0) {
        maxScore = breakdown.reduce((sum, item) => sum + item.max, 0);
    }

    return {
        id: Date.now().toString(), // 生成唯一 ID
        name: '', // 名称由调用方填充
        score,
        maxScore,
        comment,
        breakdown
    };
}

/**
 * 生成批改洞察
 */
export async function generateGradingInsight(
    avgScore: number,
    passRate: number
): Promise<string> {
    const config = getAppConfig();

    const prompt = `根据以下批改统计数据，生成一段简短的教学建议：
- 平均分：${avgScore.toFixed(1)} 分
- 及格率：${(passRate * 100).toFixed(1)}%

请用 2-3 句话给出具体、可操作的教学改进建议。`;

    if (config.provider === 'google') {
        const ai = getGoogleClient(config.apiKey);
        if (!ai) throw new Error('API Key 未配置');

        const result = await ai.models.generateContent({
            model: config.modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return result.text || '';
    } else {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.modelName,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}
