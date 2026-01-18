/**
 * ai-service.ts - AI 调用服务
 * 
 * 负责与各 AI 提供商的通信
 * 从 geminiService.ts 拆分
 */

import { GoogleGenAI } from '@google/genai';
import { AppConfig } from '../types';
import { getAppConfig } from './config-service';

/**
 * 获取 Google AI 客户端
 */
export function getGoogleClient(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || getAppConfig().apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
}

/**
 * 测试 API 连接
 */
export async function testConnection(config: AppConfig): Promise<boolean> {
    try {
        console.log('[testConnection] Testing with config:', {
            provider: config.provider,
            model: config.modelName,
            hasApiKey: !!config.apiKey
        });

        if (config.provider === 'google') {
            const ai = getGoogleClient(config.apiKey);
            if (!ai) {
                console.error('[testConnection] Failed to create Google client - API key missing');
                return false;
            }

            console.log('[testConnection] Sending test request to model:', config.modelName);
            await ai.models.generateContent({
                model: config.modelName,
                contents: 'ping',
            });
            console.log('[testConnection] Google connection successful');
            return true;
        } else {
            // OpenAI / Zhipu Compatible
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };

            const body = {
                model: config.modelName,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            };

            console.log('[testConnection] Sending request to:', config.endpoint);
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[testConnection] Request failed:', response.status, errorText);
                return false;
            }

            console.log('[testConnection] Connection successful');
            return true;
        }
    } catch (e) {
        console.error('[testConnection] Unexpected error:', e);
        return false;
    }
}

/**
 * OpenAI 兼容 API 调用助手
 */
export async function callOpenAICompatible(
    config: AppConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64: string,
    jsonMode: boolean = true
): Promise<string> {
    const messages = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: [
                { type: "text", text: userPrompt },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBase64}`
                    }
                }
            ]
        }
    ];

    const body: Record<string, unknown> = {
        model: config.modelName,
        messages: messages,
        temperature: 0.3
    };

    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        // 解析常见错误
        let errorDetail = '';
        if (response.status === 401) {
            errorDetail = 'API Key 无效或已过期';
        } else if (response.status === 404) {
            errorDetail = `模型 "${config.modelName}" 不存在或不可用`;
        } else if (response.status === 429) {
            errorDetail = 'API 请求过于频繁，请稍后重试';
        } else if (response.status === 500) {
            errorDetail = 'AI 服务内部错误';
        } else {
            errorDetail = errText.slice(0, 100) || response.statusText;
        }
        throw new Error(`API 调用失败 (${response.status}): ${errorDetail}`);
    }

    const text = await response.text();
    let data: Record<string, unknown> | null = null;

    try {
        data = JSON.parse(text);
    } catch (e: unknown) {
        throw e;
    }

    return (data as any).choices?.[0]?.message?.content || "";
}

/**
 * 多图片 OpenAI 兼容 API 调用
 */
export async function callOpenAICompatibleMultiImage(
    config: AppConfig,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    jsonMode: boolean = true
): Promise<string> {
    type ImageContent =
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } };

    const imageContents: ImageContent[] = [];

    for (const img of images) {
        if (img.label) {
            imageContents.push({ type: "text", text: img.label });
        }
        imageContents.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${img.base64}` }
        });
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: [
                { type: "text", text: userPrompt },
                ...imageContents
            ]
        }
    ];

    const body: Record<string, unknown> = {
        model: config.modelName,
        messages: messages,
        temperature: 0.3
    };

    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let errorDetail = '';
        if (response.status === 401) {
            errorDetail = 'API Key 无效或已过期';
        } else if (response.status === 404) {
            errorDetail = `模型 "${config.modelName}" 不存在或不可用`;
        } else if (response.status === 429) {
            errorDetail = 'API 请求过于频繁，请稍后重试';
        } else if (response.status === 500) {
            errorDetail = 'AI 服务内部错误';
        } else {
            errorDetail = errText.slice(0, 100) || response.statusText;
        }
        throw new Error(`API 调用失败 (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}
