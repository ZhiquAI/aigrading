/**
 * alibabaService.ts - 阿里云百炼 Qwen-VL 服务
 * 
 * 支持阿里云百炼平台的通义千问视觉模型 (Qwen-VL)
 * 使用 OpenAI 兼容格式 API
 */

import { AppConfig } from '../types';

// ==================== 默认配置 ====================

export const ALIBABA_DEFAULTS = {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen-vl-max', 'qwen-vl-plus', 'qwen3-vl-plus', 'qwen3-vl-flash']
};

// ==================== 类型定义 ====================

export interface AlibabaConfig {
    apiKey: string;        // 格式: sk-xxxxx
    endpoint?: string;     // 支持自定义 API 地址
    modelName?: string;
}

interface AlibabaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | AlibabaContentPart[];
}

type AlibabaContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

interface AlibabaResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface AlibabaStreamChunk {
    choices: Array<{
        delta: {
            content?: string;
            reasoning_content?: string;
        };
    }>;
}

// ==================== 核心调用函数 ====================

/**
 * 调用阿里云 Qwen-VL API
 * 支持 OpenAI 兼容格式
 */
export async function callAlibaba(
    config: AlibabaConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        jsonMode?: boolean;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    const endpoint = config.endpoint || ALIBABA_DEFAULTS.endpoint;
    const modelName = config.modelName || 'qwen-vl-max';

    // 构建消息
    const userContent: AlibabaContentPart[] = [];

    // 图片放在文本前面（阿里云推荐）
    if (imageBase64) {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
            }
        });
    }

    userContent.push({ type: 'text', text: userPrompt });

    const messages: AlibabaMessage[] = [
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

    // Qwen-VL 支持 JSON 模式（仅部分模型）
    if (options?.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(parseAlibabaError(response.status, errorText, modelName));
    }

    const data: AlibabaResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 流式调用阿里云 Qwen-VL API
 * 逐块返回内容，实现实时显示效果
 */
export async function* callAlibabaStream(
    config: AlibabaConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        temperature?: number;
        maxTokens?: number;
        enableThinking?: boolean;
    }
): AsyncGenerator<string, void, unknown> {
    const endpoint = config.endpoint || ALIBABA_DEFAULTS.endpoint;
    const modelName = config.modelName || 'qwen-vl-max';

    // 构建消息
    const userContent: AlibabaContentPart[] = [];

    if (imageBase64) {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
            }
        });
    }

    userContent.push({ type: 'text', text: userPrompt });

    const messages: AlibabaMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const body: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options?.temperature ?? 0.3,
        stream: true,
        max_tokens: options?.maxTokens ?? 4096  // 默认 4096 防止响应截断
    };

    // Qwen3-VL 系列支持思考模式
    if (options?.enableThinking && modelName.includes('qwen3-vl')) {
        body.extra_body = {
            enable_thinking: true,
            thinking_budget: 8192
        };
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(parseAlibabaError(response.status, errorText, modelName));
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = (line: string): string | null => {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') return null;

        if (trimmed.startsWith('data: ')) {
            try {
                const chunk: AlibabaStreamChunk = JSON.parse(trimmed.slice(6));
                return chunk.choices?.[0]?.delta?.content || null;
            } catch {
                // 忽略解析错误
                return null;
            }
        }
        return null;
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const content = processLine(line);
                if (content) {
                    yield content;
                }
            }
        }

        // 处理流结束后剩余的缓冲区数据
        if (buffer.trim()) {
            const content = processLine(buffer);
            if (content) {
                yield content;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * 多图片调用阿里云 Qwen-VL API
 */
export async function callAlibabaMultiImage(
    config: AlibabaConfig,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: {
        jsonMode?: boolean;
        temperature?: number;
    }
): Promise<string> {
    const endpoint = config.endpoint || ALIBABA_DEFAULTS.endpoint;
    const modelName = config.modelName || 'qwen-vl-max';

    // 构建包含多图片的内容
    const userContent: AlibabaContentPart[] = [];

    for (const img of images) {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${img.base64}`
            }
        });
        if (img.label) {
            userContent.push({ type: 'text', text: img.label });
        }
    }

    userContent.push({ type: 'text', text: userPrompt });

    const messages: AlibabaMessage[] = [
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

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(parseAlibabaError(response.status, errorText, modelName));
    }

    const data: AlibabaResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 测试阿里云 API 连接
 */
export async function testAlibabaConnection(config: AlibabaConfig): Promise<boolean> {
    try {
        // 验证 API Key 格式
        if (!config.apiKey.startsWith('sk-')) {
            console.warn('[Alibaba] API Key 格式可能不正确，应以 sk- 开头');
        }

        const endpoint = config.endpoint || ALIBABA_DEFAULTS.endpoint;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.modelName || 'qwen-vl-max',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            }),
            signal: AbortSignal.timeout(15000)
        });

        return response.ok;
    } catch (e) {
        console.error('[Alibaba] Connection test failed:', e);
        return false;
    }
}

/**
 * 验证阿里云 API Key 格式
 */
export function validateAlibabaApiKey(apiKey: string): boolean {
    // 阿里云 API Key 格式: sk-xxxxx
    return apiKey.startsWith('sk-') && apiKey.length > 10;
}

// ==================== 辅助函数 ====================

/**
 * 解析阿里云 API 错误
 */
function parseAlibabaError(status: number, errorText: string, modelName: string): string {
    switch (status) {
        case 401:
            return 'API Key 无效或已过期';
        case 403:
            return 'API Key 权限不足或未开通百炼服务';
        case 404:
            return `模型 "${modelName}" 不存在或不可用`;
        case 429:
            return 'API 请求过于频繁，请稍后重试';
        case 500:
        case 502:
        case 503:
            return '阿里云百炼服务暂时不可用，请稍后重试';
        default:
            // 尝试解析阿里云特定的错误格式
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                    return errorData.error.message;
                }
                if (errorData.message) {
                    return errorData.message;
                }
            } catch {
                // 忽略解析错误
            }
            return `API 调用失败 (${status}): ${errorText.slice(0, 100)}`;
    }
}

/**
 * 从 AppConfig 创建阿里云配置
 */
export function createAlibabaConfig(appConfig: AppConfig): AlibabaConfig {
    return {
        apiKey: appConfig.apiKey,
        endpoint: appConfig.endpoint || ALIBABA_DEFAULTS.endpoint,
        modelName: appConfig.modelName
    };
}
