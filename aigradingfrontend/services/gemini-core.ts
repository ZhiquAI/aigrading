/**
 * gemini-core.ts - Google Gemini 核心服务
 * 
 * 纯粹的 Gemini API 调用服务，不包含其他模型逻辑
 * 支持自定义 endpoint 以兼容第三方 Gemini API 代理
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ==================== 默认配置 ====================

export const GEMINI_DEFAULTS = {
    models: ['gemini-2.0-flash-exp', 'gemini-3-pro-preview', 'gemini-2.5-flash-preview-05-20'],
    defaultModel: 'gemini-2.0-flash-exp'
};

// ==================== 类型定义 ====================

export interface GeminiConfig {
    apiKey: string;
    modelName?: string;
    thinkingBudget?: number;
    jsonMode?: boolean;
    temperature?: number;
}

// ==================== 客户端管理 ====================

/**
 * 创建 Gemini 客户端
 */
export function createGeminiClient(apiKey: string): GoogleGenerativeAI | null {
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
}

// ==================== 核心调用函数 ====================

/**
 * 调用 Gemini API - 单图片
 */
export async function callGemini(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: {
        modelName?: string;
        thinkingBudget?: number;
        jsonMode?: boolean;
        temperature?: number;
    }
): Promise<string> {
    const ai = createGeminiClient(apiKey);
    if (!ai) throw new Error('Gemini API Key 未配置');

    const modelName = options?.modelName || GEMINI_DEFAULTS.defaultModel;

    // 构建 parts
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: systemPrompt + '\n\n' + userPrompt }
    ];

    if (imageBase64) {
        parts.push({
            inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
        });
    }

    // 构建配置
    const generateConfig: Record<string, unknown> = {};

    if (options?.thinkingBudget) {
        generateConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    if (options?.jsonMode) {
        generateConfig.responseMimeType = 'application/json';
    }

    const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: Object.keys(generateConfig).length > 0 ? generateConfig as any : undefined
    });

    const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return response.response.text() || '';
}

/**
 * 调用 Gemini API - 多图片
 */
export async function callGeminiMultiImage(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: {
        modelName?: string;
        thinkingBudget?: number;
    }
): Promise<string> {
    const ai = createGeminiClient(apiKey);
    if (!ai) throw new Error('Gemini API Key 未配置');

    const modelName = options?.modelName || GEMINI_DEFAULTS.defaultModel;

    // 构建 parts
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: systemPrompt + '\n\n' + userPrompt }
    ];

    for (const img of images) {
        if (img.label) {
            parts.push({ text: img.label });
        }
        parts.push({
            inlineData: { mimeType: 'image/jpeg', data: img.base64 }
        });
    }

    // 构建配置
    const generateConfig: Record<string, unknown> = {};

    if (options?.thinkingBudget) {
        generateConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: Object.keys(generateConfig).length > 0 ? generateConfig as any : undefined
    });

    const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return response.response.text() || '';
}

/**
 * 纯文本调用 Gemini
 */
export async function callGeminiText(
    apiKey: string,
    prompt: string,
    options?: {
        modelName?: string;
        maxTokens?: number;
    }
): Promise<string> {
    const ai = createGeminiClient(apiKey);
    if (!ai) throw new Error('Gemini API Key 未配置');

    const modelName = options?.modelName || GEMINI_DEFAULTS.defaultModel;

    const model = ai.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(prompt);
    return response.response.text() || '';
}

/**
 * 测试 Gemini 连接
 */
export async function testGeminiConnection(
    apiKey: string,
    modelName?: string
): Promise<boolean> {
    try {
        const ai = createGeminiClient(apiKey);
        if (!ai) return false;

        const model = ai.getGenerativeModel({ model: modelName || GEMINI_DEFAULTS.defaultModel });
        await model.generateContent('ping');

        return true;
    } catch (e) {
        console.error('[Gemini] Connection test failed:', e);
        return false;
    }
}

/**
 * 带结构化输出的 Gemini 调用
 */
export async function callGeminiWithSchema(
    apiKey: string,
    prompt: string,
    imageBase64: string,
    schema: Record<string, unknown>,
    options?: {
        modelName?: string;
        thinkingBudget?: number;
    }
): Promise<string> {
    const ai = createGeminiClient(apiKey);
    if (!ai) throw new Error('Gemini API Key 未配置');

    const modelName = options?.modelName || GEMINI_DEFAULTS.defaultModel;

    const generateConfig: Record<string, unknown> = {
        responseMimeType: 'application/json',
        responseSchema: schema
    };

    if (options?.thinkingBudget) {
        generateConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: generateConfig as any
    });

    const response = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ]
        }]
    });

    return response.response.text() || '{}';
}

// ==================== 策略配置 ====================

export type GradingStrategy = 'flash' | 'pro' | 'reasoning';

/**
 * Gemini 策略模型映射
 */
export const GEMINI_STRATEGY_CONFIG: Record<GradingStrategy, {
    model: string;
    thinkingBudget?: number;
    description: string
}> = {
    flash: {
        model: 'gemini-2.0-flash-exp',
        thinkingBudget: undefined,
        description: '快速模式 - 适合简单填空、选择题'
    },
    pro: {
        model: 'gemini-2.0-flash-exp',
        thinkingBudget: 2048,
        description: '精准模式 - 适合常规简答题'
    },
    reasoning: {
        model: 'gemini-3-pro-preview',
        thinkingBudget: 16384,
        description: '深度模式 - 适合复杂论述、开放题'
    }
};

/**
 * 获取策略对应的模型配置
 */
export function getGeminiStrategyConfig(strategy: GradingStrategy) {
    return GEMINI_STRATEGY_CONFIG[strategy] || GEMINI_STRATEGY_CONFIG.flash;
}
