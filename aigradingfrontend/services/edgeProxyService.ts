/**
 * edgeProxyService.ts - Edge Function 代理服务
 * 
 * 使用后端 Edge Function 进行 AI 调用
 * - API Key 存储在服务端（安全）
 * - Edge 节点低延迟
 * - 统一 OpenAI 格式
 */

import { StudentResult } from '../types';

// 后端 API 地址
// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// Edge 代理端点
const EDGE_PROXY_URL = `${API_BASE_URL}/api/ai/proxy`;

// ==================== 类型定义 ====================

export interface EdgeProxyOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | MessageContent[];
}

type MessageContent =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

// ==================== 核心函数 ====================

/**
 * 通过 Edge 代理调用 AI
 */
export async function callAIWithEdge(
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: EdgeProxyOptions
): Promise<string> {
    const model = options?.model || 'gemini-2.0-flash-exp';

    // 构建消息
    const userContent: MessageContent[] = [{ type: 'text', text: userPrompt }];

    if (imageBase64) {
        userContent.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        });
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const response = await fetch(EDGE_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? 0.3,
            max_tokens: options?.maxTokens,
            stream: options?.stream ?? false
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Edge Proxy Error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 通过 Edge 代理批改学生答案
 */
export async function gradeWithEdge(
    imageBase64: string,
    rubric: string,
    options?: {
        studentName?: string;
        model?: string;
    }
): Promise<StudentResult> {
    const model = options?.model || 'gemini-2.0-flash-exp';

    // 检测是否为 JSON 格式的评分细则
    const isJSONRubric = rubric.trim().startsWith('{') || rubric.includes('"answerPoints"');

    let userPrompt: string;
    if (isJSONRubric) {
        userPrompt = `你是一位高效的阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubric}

【评分规则】
1. 逐一检查 answerPoints 中的每个得分点
2. 根据 keywords 关键词匹配学生答案（允许同义表述）
3. 根据 scoringStrategy 计算最终得分

【输出格式】
返回 JSON：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 编号 | 得分 | 理由 |\\n|---|---|---|\\n| 1-1 | 2/2 | ✓ 正确 |",
  "breakdown": [{"label": "得分点", "score": 2, "max": 2, "comment": "✓ 正确"}]
}`;
    } else {
        userPrompt = `你是一位高效的阅卷专家。请根据【评分细则】对【学生答案】进行快速评分。

【评分细则】
${rubric}

【评分要求】
1. 快速判断得分，评语简洁明了
2. comment 使用 Markdown 表格格式
3. breakdown 必须包含每个得分点

返回 JSON 格式：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 题号 | 得分 | 理由 |\\n|---|---|---|\\n| (1) | 4/4 | ✓ 正确 |",
  "breakdown": [{"label": "得分点", "score": 4, "max": 4, "comment": "✓ 正确"}]
}`;
    }

    const systemPrompt = '你是一位高效的阅卷专家。请根据评分细则对学生答案进行评分，返回 JSON 格式结果。';

    // 使用 Edge 代理调用
    const responseText = await callAIWithEdge(systemPrompt, userPrompt, imageBase64, {
        model,
        temperature: 0.3
    });

    // 解析响应
    const cleanedText = cleanJsonResponse(responseText);
    const result = JSON.parse(cleanedText);

    return {
        id: Date.now().toString(),
        name: options?.studentName || '自动识别',
        className: '自动识别',
        score: result.score || 0,
        maxScore: result.maxScore || 10,
        comment: result.comment || '',
        breakdown: result.breakdown || []
    };
}

/**
 * 获取可用模型列表
 */
export async function getAvailableModels(): Promise<Array<{
    id: string;
    provider: string;
    available: boolean;
}>> {
    try {
        const response = await fetch(EDGE_PROXY_URL, { method: 'GET' });
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error('[EdgeProxy] Failed to get models:', error);
        return [];
    }
}

/**
 * 测试 Edge 代理连接
 */
export async function testEdgeConnection(model?: string): Promise<boolean> {
    try {
        const response = await fetch(EDGE_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model || 'gemini-2.0-flash-exp',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            }),
            signal: AbortSignal.timeout(10000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ==================== 辅助函数 ====================

/**
 * 清理 JSON 响应
 */
function cleanJsonResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
        cleaned = cleaned.replace(/\n?```\s*$/, '');
    }
    return cleaned.trim();
}

/**
 * 检查是否启用 Edge 代理模式
 */
export function isEdgeProxyMode(): boolean {
    return localStorage.getItem('edge_proxy_mode') === 'true';
}

/**
 * 设置 Edge 代理模式
 */
export function setEdgeProxyMode(enabled: boolean): void {
    localStorage.setItem('edge_proxy_mode', enabled ? 'true' : 'false');
}
