/**
 * zhipuService.ts - 智谱 AI 服务
 * 
 * 支持智谱 AI 官方 API 及兼容格式的第三方服务
 * 智谱使用 OpenAI 兼容格式，但有自己的认证方式
 */

import { AppConfig } from '../types';

// ==================== 默认配置 ====================

export const ZHIPU_DEFAULTS = {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['glm-4v', 'glm-4v-flash', 'glm-4', 'glm-4-flash']
};

// ==================== 类型定义 ====================

export interface ZhipuConfig {
    apiKey: string;        // 格式: {id}.{secret}
    endpoint?: string;     // 支持自定义第三方 API 地址
    modelName?: string;
}

interface ZhipuMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | ZhipuContentPart[];
}

type ZhipuContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

interface ZhipuResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

// ==================== 核心调用函数 ====================

/**
 * 调用智谱 AI API
 * 支持自定义 endpoint 的第三方 API
 */
export async function callZhipu(
    config: ZhipuConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        jsonMode?: boolean;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    const endpoint = config.endpoint || ZHIPU_DEFAULTS.endpoint;
    const modelName = config.modelName || 'glm-4v';

    // 构建消息
    const userContent: ZhipuContentPart[] = [{ type: 'text', text: userPrompt }];

    if (imageBase64) {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
            }
        });
    }

    const messages: ZhipuMessage[] = [
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

    // 智谱 API 不支持 json_mode，但可以通过 prompt 引导
    // 如果需要 JSON 输出，在 systemPrompt 中明确要求即可

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
        throw new Error(parseZhipuError(response.status, errorText, modelName));
    }

    const data: ZhipuResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 多图片调用智谱 AI API
 */
export async function callZhipuMultiImage(
    config: ZhipuConfig,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: {
        temperature?: number;
    }
): Promise<string> {
    const endpoint = config.endpoint || ZHIPU_DEFAULTS.endpoint;
    const modelName = config.modelName || 'glm-4v';

    // 构建包含多图片的内容
    const userContent: ZhipuContentPart[] = [{ type: 'text', text: userPrompt }];

    for (const img of images) {
        if (img.label) {
            userContent.push({ type: 'text', text: img.label });
        }
        userContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${img.base64}`
            }
        });
    }

    const messages: ZhipuMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const body: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: options?.temperature ?? 0.3
    };

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
        throw new Error(parseZhipuError(response.status, errorText, modelName));
    }

    const data: ZhipuResponse = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * 测试智谱 AI API 连接
 */
export async function testZhipuConnection(config: ZhipuConfig): Promise<boolean> {
    try {
        // 智谱 API Key 格式验证: {id}.{secret}
        if (!config.apiKey.includes('.')) {
            console.warn('[Zhipu] API Key 格式不正确，应为 {id}.{secret}');
            return false;
        }

        const endpoint = config.endpoint || ZHIPU_DEFAULTS.endpoint;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.modelName || 'glm-4-flash',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            }),
            signal: AbortSignal.timeout(10000)
        });

        return response.ok;
    } catch (e) {
        console.error('[Zhipu] Connection test failed:', e);
        return false;
    }
}

/**
 * 验证智谱 API Key 格式
 */
export function validateZhipuApiKey(apiKey: string): boolean {
    // 智谱 API Key 格式: {id}.{secret}
    return apiKey.includes('.') && apiKey.split('.').length === 2;
}

// ==================== 辅助函数 ====================

/**
 * 解析智谱 API 错误
 */
function parseZhipuError(status: number, errorText: string, modelName: string): string {
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
            return '智谱 AI 服务暂时不可用，请稍后重试';
        default:
            // 尝试解析智谱特定的错误格式
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                    return errorData.error.message;
                }
            } catch {
                // 忽略解析错误
            }
            return `API 调用失败 (${status}): ${errorText.slice(0, 100)}`;
    }
}

/**
 * 从 AppConfig 创建智谱配置
 */
export function createZhipuConfig(appConfig: AppConfig): ZhipuConfig {
    return {
        apiKey: appConfig.apiKey,
        endpoint: appConfig.endpoint || ZHIPU_DEFAULTS.endpoint,
        modelName: appConfig.modelName
    };
}
