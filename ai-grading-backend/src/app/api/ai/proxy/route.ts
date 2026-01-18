/**
 * Edge Function AI 代理
 * 
 * 使用 Edge Runtime 实现低延迟的 AI API 代理
 * - API Key 存储在服务端（安全）
 * - Edge 节点离用户近（低延迟）
 * - 支持流式响应
 */

import { NextRequest } from 'next/server';

// 使用 Edge Runtime - 更快的冷启动和更低的延迟
export const runtime = 'edge';

// 支持的模型提供商配置
const PROVIDERS = {
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.0-flash-exp', 'gemini-3-pro-preview'],
        getHeaders: (apiKey: string) => ({
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        })
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        getHeaders: (apiKey: string) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        })
    },
    zhipu: {
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        models: ['glm-4v', 'glm-4v-flash', 'glm-4'],
        getHeaders: (apiKey: string) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        })
    },
    gptsapi: {
        baseUrl: process.env.GPT_API_URL || 'https://api.gptsapi.net/v1/chat/completions',
        models: ['gpt-4o', 'gemini-2.5-flash', 'claude-3-5-sonnet'],
        getHeaders: (apiKey: string) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        })
    }
};

// 获取 API Key
function getApiKey(provider: string): string {
    switch (provider) {
        case 'gemini':
            return process.env.GEMINI_API_KEY || '';
        case 'openai':
            return process.env.OPENAI_API_KEY || '';
        case 'zhipu':
            return process.env.ZHIPU_API_KEY || '';
        case 'gptsapi':
            return process.env.GPT_API_KEY || process.env.GPTSAPI_KEY || '';
        default:
            return '';
    }
}

// 根据模型名推断提供商
function inferProvider(model: string): string {
    if (model.startsWith('gemini')) return 'gemini';
    if (model.startsWith('gpt') || model.startsWith('o1')) return 'gptsapi'; // 使用 GPTsAPI 代理
    if (model.startsWith('glm')) return 'zhipu';
    if (model.startsWith('claude')) return 'gptsapi'; // Claude 通过 GPTsAPI
    return 'gptsapi'; // 默认使用 GPTsAPI
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { model, messages, stream = false, ...rest } = body;

        if (!model || !messages) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: model, messages' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 推断提供商
        const provider = inferProvider(model);
        const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];

        if (!providerConfig) {
            return new Response(
                JSON.stringify({ error: `Unknown provider for model: ${model}` }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = getApiKey(provider);
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: `API key not configured for provider: ${provider}` }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 构建请求 URL
        let url = providerConfig.baseUrl;

        // Gemini 需要特殊处理
        if (provider === 'gemini') {
            url = `${providerConfig.baseUrl}/models/${model}:generateContent`;

            // 转换 OpenAI 格式到 Gemini 格式
            const geminiBody = {
                contents: messages.map((msg: any) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: typeof msg.content === 'string'
                        ? [{ text: msg.content }]
                        : msg.content.map((c: any) => {
                            if (c.type === 'text') return { text: c.text };
                            if (c.type === 'image_url') {
                                const base64 = c.image_url.url.replace(/^data:image\/\w+;base64,/, '');
                                return { inlineData: { mimeType: 'image/jpeg', data: base64 } };
                            }
                            return c;
                        })
                })),
                ...rest
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: providerConfig.getHeaders(apiKey),
                body: JSON.stringify(geminiBody)
            });

            if (!response.ok) {
                const error = await response.text();
                return new Response(error, { status: response.status });
            }

            // 转换 Gemini 响应为 OpenAI 格式
            const geminiResult = await response.json();

            // 正确提取响应文本,处理深度推理模式的 thinking 部分
            let content = '';
            const parts = geminiResult.candidates?.[0]?.content?.parts || [];

            // 深度推理模式下,parts 可能包含多个元素(thinking + 实际结果)
            // 过滤掉 thinking 部分,只保留实际的 JSON 响应
            if (parts.length > 0) {
                for (const part of parts) {
                    // thinking 部分通常有 thought 字段
                    // 实际的 JSON 结果在普通的 text part 中
                    if (part.text && !part.thought) {
                        // 判断是否是 JSON 格式
                        const trimmedText = part.text.trim();
                        if (trimmedText.startsWith('{') || trimmedText.startsWith('```')) {
                            content = part.text;
                            break;  // 找到第一个 JSON 格式的文本即可
                        }
                        // 保留作为备用
                        if (!content) {
                            content = part.text;
                        }
                    }
                }
            }

            // 如果没有找到合适的 part,回退到第一个 part
            if (!content && parts[0]?.text) {
                content = parts[0].text;
            }

            const openaiFormat = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: content
                    },
                    finish_reason: 'stop'
                }],
                usage: geminiResult.usageMetadata || {}
            };

            return new Response(JSON.stringify(openaiFormat), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // OpenAI / 智谱 / GPTsAPI - 直接代理
        const response = await fetch(url, {
            method: 'POST',
            headers: providerConfig.getHeaders(apiKey),
            body: JSON.stringify({ model, messages, stream, ...rest })
        });

        // 流式响应直接透传
        if (stream) {
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
        }

        // 非流式响应
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Edge Proxy] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// 获取可用模型列表
export async function GET() {
    const models = Object.entries(PROVIDERS).flatMap(([provider, config]) =>
        config.models.map(model => ({
            id: model,
            provider,
            available: !!getApiKey(provider)
        }))
    );

    return new Response(JSON.stringify({ models }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
