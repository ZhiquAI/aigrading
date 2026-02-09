/**
 * openaiService.ts - OpenAI 服务
 * 
 * 支持 OpenAI 官方 API 及所有兼容 OpenAI API 格式的第三方服务
 * 如：Azure OpenAI、Moonshot、DeepSeek、零一万物等
 */

import { StudentResult, AppConfig } from '../types';
import { logAPIRequest, logAPIResponse, logAPIError, startTimer, endTimer } from './debug-utils';

// ==================== 默认配置 ====================

export const OPENAI_DEFAULTS = {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet']
};

// ==================== 类型定义 ====================

export interface OpenAIConfig {
    apiKey: string;
    endpoint?: string;  // 支持自定义第三方 API 地址
    modelName?: string;
}

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | OpenAIContentPart[];
}

type OpenAIContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface OpenAIStreamChunk {
    choices: Array<{
        delta: {
            content?: string;
        };
    }>;
}

// ==================== 核心调用函数 ====================

/**
 * 调用 OpenAI 兼容 API
 * 支持所有 OpenAI 格式的第三方 API
 */
export async function callOpenAI(
    config: OpenAIConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        jsonMode?: boolean;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    let endpoint = config.endpoint || OPENAI_DEFAULTS.endpoint;

    // 自动修正 endpoint: 如果以 /api 结尾，很可能是 gptsapi.net 这种代理地址，需要补全
    if (endpoint.endsWith('/api')) {
        endpoint = endpoint + '/v1/chat/completions';
    } else if (endpoint.endsWith('/v1')) {
        endpoint = endpoint + '/chat/completions';
    }

    const modelName = config.modelName || 'gpt-4o';

    // 构建消息
    const userContent: OpenAIContentPart[] = [{ type: 'text', text: userPrompt }];

    if (imageBase64) {
        // 处理图片格式：支持纯 base64 或完整 data URL
        const imageUrl = imageBase64.startsWith('data:')
            ? imageBase64  // 已经是完整的 data URL，直接使用
            : `data:image/jpeg;base64,${imageBase64}`;  // 纯 base64，添加前缀

        userContent.push({
            type: 'image_url',
            image_url: {
                url: imageUrl,
                detail: 'high'
            }
        });
    }

    const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const body: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options?.temperature ?? 0.3
    };

    if (options?.maxTokens) {
        body.max_tokens = options.maxTokens;
    }

    if (options?.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    // 构建 headers，OpenRouter 需要额外的 HTTP-Referer 和 X-Title
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };

    // 检测是否为 OpenRouter endpoint，添加额外 headers
    if (endpoint.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://ai-grading.app';
        headers['X-Title'] = 'AI Grading Assistant';
    }

    // 🔍 调试日志
    logAPIRequest(endpoint, 'POST', { model: modelName, hasImage: !!imageBase64 });
    startTimer(`openai-${modelName}`);

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    } catch (fetchError) {
        // 网络层错误 (CORS, 连接失败等)
        endTimer(`openai-${modelName}`);
        logAPIError(endpoint, fetchError);
        throw new Error(`网络请求失败: ${(fetchError as Error).message}`);
    }

    const duration = endTimer(`openai-${modelName}`);
    logAPIResponse(endpoint, response.status, undefined, duration);

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        console.error('[OpenAI] Error body:', errorBody);
        const { parseAPIError } = await import('./ai-error');
        throw parseAPIError(response.status, errorBody);
    }


    const data: OpenAIResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 流式调用 OpenAI 兼容 API
 * 逐块返回内容，实现实时显示效果
 */
export async function* callOpenAIStream(
    config: OpenAIConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        temperature?: number;
        maxTokens?: number;
    }
): AsyncGenerator<string, void, unknown> {
    let endpoint = config.endpoint || OPENAI_DEFAULTS.endpoint;

    // 自动修正 endpoint
    if (endpoint.endsWith('/api')) {
        endpoint = endpoint + '/v1/chat/completions';
    } else if (endpoint.endsWith('/v1')) {
        endpoint = endpoint + '/chat/completions';
    }

    const modelName = config.modelName || 'gpt-4o';

    // 构建消息
    const userContent: OpenAIContentPart[] = [{ type: 'text', text: userPrompt }];

    if (imageBase64) {
        // 处理图片格式：支持纯 base64 或完整 data URL
        const imageUrl = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

        userContent.push({
            type: 'image_url',
            image_url: {
                url: imageUrl,
                detail: 'high'
            }
        });
    }

    const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const body: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options?.temperature ?? 0.3,
        stream: true  // 开启流式输出
    };

    if (options?.maxTokens) {
        body.max_tokens = options.maxTokens;
    }

    // OpenRouter headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };
    if (endpoint.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://ai-grading.app';
        headers['X-Title'] = 'AI Grading Assistant';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        const { parseAPIError } = await import('./ai-error');
        throw parseAPIError(response.status, errorBody);
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;

                if (trimmed.startsWith('data: ')) {
                    try {
                        const json: OpenAIStreamChunk = JSON.parse(trimmed.slice(6));
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;  // 逐块返回内容
                        }
                    } catch (e) {
                        console.warn('[OpenAI Stream] Parse error:', e);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * 多图片调用 OpenAI 兼容 API
 */
export async function callOpenAIMultiImage(
    config: OpenAIConfig,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: {
        jsonMode?: boolean;
        temperature?: number;
    }
): Promise<string> {
    let endpoint = config.endpoint || OPENAI_DEFAULTS.endpoint;

    // 自动修正 endpoint: 如果以 /api 结尾，很可能是 gptsapi.net 这种代理地址，需要补全
    if (endpoint.endsWith('/api')) {
        endpoint = endpoint + '/v1/chat/completions';
    } else if (endpoint.endsWith('/v1')) {
        endpoint = endpoint + '/chat/completions';
    }

    const modelName = config.modelName || 'gpt-4o';

    // 构建包含多图片的内容
    const userContent: OpenAIContentPart[] = [{ type: 'text', text: userPrompt }];

    for (const img of images) {
        if (img.label) {
            userContent.push({ type: 'text', text: img.label });
        }
        // 处理图片格式：支持纯 base64 或完整 data URL
        const imageUrl = img.base64.startsWith('data:')
            ? img.base64
            : `data:image/jpeg;base64,${img.base64}`;

        userContent.push({
            type: 'image_url',
            image_url: {
                url: imageUrl,
                detail: 'high'
            }
        });
    }

    const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const body: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options?.temperature ?? 0.3
    };

    if (options?.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    // OpenRouter headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };
    if (endpoint.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://ai-grading.app';
        headers['X-Title'] = 'AI Grading Assistant';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        const { parseAPIError } = await import('./ai-error');
        throw parseAPIError(response.status, errorBody);
    }


    const data: OpenAIResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 测试 OpenAI API 连接
 */
export async function testOpenAIConnection(config: OpenAIConfig): Promise<boolean> {
    try {
        const endpoint = config.endpoint || OPENAI_DEFAULTS.endpoint;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.modelName || 'gpt-4o',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            }),
            signal: AbortSignal.timeout(10000)
        });

        return response.ok;
    } catch (e) {
        console.error('[OpenAI] Connection test failed:', e);
        return false;
    }
}

// ==================== 辅助函数 ====================

/**
 * 解析 OpenAI API 错误
 */
function parseOpenAIError(status: number, errorText: string, modelName: string): string {
    switch (status) {
        case 401:
            return 'API Key 无效或已过期';
        case 403:
            return 'API Key 权限不足';
        case 404:
            return `模型 "${modelName}" 不存在或不可用`;
        case 429:
            return 'API 请求过于频繁，请稍后重试';
        case 500:
        case 502:
        case 503:
            return 'OpenAI 服务暂时不可用，请稍后重试';
        default:
            return `API 调用失败 (${status}): ${errorText.slice(0, 100)}`;
    }
}

/**
 * 从 AppConfig 创建 OpenAI 配置
 */
export function createOpenAIConfig(appConfig: AppConfig): OpenAIConfig {
    return {
        apiKey: appConfig.apiKey,
        endpoint: appConfig.endpoint || OPENAI_DEFAULTS.endpoint,
        modelName: appConfig.modelName
    };
}
