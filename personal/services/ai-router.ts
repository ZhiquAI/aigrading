/**
 * ai-router.ts - AI 模型统一调度层
 * 
 * 根据用户配置的 provider 自动路由到对应的模型服务
 * 支持 Google Gemini、OpenAI、智谱等多个提供商
 */

import { AppConfig, StudentResult } from '../types';
import { getAppConfig } from './config-service';

// 导入各模型服务
import { callGemini, callGeminiMultiImage, testGeminiConnection } from './gemini-core';
import { callOpenAI, callOpenAIMultiImage, testOpenAIConnection, createOpenAIConfig } from './openaiService';
import { callZhipu, callZhipuMultiImage, testZhipuConnection, createZhipuConfig } from './zhipuService';
import { callAlibaba, callAlibabaMultiImage, testAlibabaConnection, createAlibabaConfig } from './alibabaService';

// ==================== 类型定义 ====================

export type ModelProvider = 'google' | 'openai' | 'zhipu' | 'alibaba';

export interface AICallOptions {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
    thinkingBudget?: number;  // Gemini 特有
}

// ==================== 统一调用接口 ====================

/**
 * 统一 AI 调用 - 自动根据 provider 路由
 */
export async function callAI(
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: AICallOptions
): Promise<string> {
    const config = getAppConfig();
    return callAIWithConfig(config, systemPrompt, userPrompt, imageBase64, options);
}

/**
 * 使用指定配置调用 AI
 */
export async function callAIWithConfig(
    config: AppConfig,
    systemPrompt: string,
    userPrompt: string,
    imageBase64?: string,
    options?: AICallOptions
): Promise<string> {
    const provider = config.provider as ModelProvider;

    switch (provider) {
        case 'google':
            return callGemini(
                config.apiKey,
                systemPrompt,
                userPrompt,
                imageBase64,
                {
                    modelName: config.modelName,
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature,
                    thinkingBudget: options?.thinkingBudget
                }
            );

        case 'openai':
            return callOpenAI(
                createOpenAIConfig(config),
                systemPrompt,
                userPrompt,
                imageBase64,
                {
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature,
                    maxTokens: options?.maxTokens
                }
            );

        case 'zhipu':
            return callZhipu(
                createZhipuConfig(config),
                systemPrompt,
                userPrompt,
                imageBase64,
                {
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature,
                    maxTokens: options?.maxTokens
                }
            );

        case 'alibaba':
            return callAlibaba(
                createAlibabaConfig(config),
                systemPrompt,
                userPrompt,
                imageBase64,
                {
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature,
                    maxTokens: options?.maxTokens
                }
            );

        default:
            throw new Error(`不支持的 AI 提供商: ${provider}`);
    }
}

/**
 * 统一多图片 AI 调用
 */
export async function callAIMultiImage(
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: AICallOptions
): Promise<string> {
    const config = getAppConfig();
    return callAIMultiImageWithConfig(config, systemPrompt, userPrompt, images, options);
}

/**
 * 使用指定配置的多图片调用
 */
export async function callAIMultiImageWithConfig(
    config: AppConfig,
    systemPrompt: string,
    userPrompt: string,
    images: Array<{ base64: string; label?: string }>,
    options?: AICallOptions
): Promise<string> {
    const provider = config.provider as ModelProvider;

    switch (provider) {
        case 'google':
            return callGeminiMultiImage(
                config.apiKey,
                systemPrompt,
                userPrompt,
                images,
                {
                    modelName: config.modelName,
                    thinkingBudget: options?.thinkingBudget
                }
            );

        case 'openai':
            return callOpenAIMultiImage(
                createOpenAIConfig(config),
                systemPrompt,
                userPrompt,
                images,
                {
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature
                }
            );

        case 'zhipu':
            return callZhipuMultiImage(
                createZhipuConfig(config),
                systemPrompt,
                userPrompt,
                images,
                { temperature: options?.temperature }
            );

        case 'alibaba':
            return callAlibabaMultiImage(
                createAlibabaConfig(config),
                systemPrompt,
                userPrompt,
                images,
                {
                    jsonMode: options?.jsonMode,
                    temperature: options?.temperature
                }
            );

        default:
            throw new Error(`不支持的 AI 提供商: ${provider}`);
    }
}

/**
 * 统一连接测试
 */
export async function testAIConnection(config?: AppConfig): Promise<boolean> {
    const c = config || getAppConfig();
    const provider = c.provider as ModelProvider;

    switch (provider) {
        case 'google':
            return testGeminiConnection(c.apiKey, c.modelName);

        case 'openai':
            return testOpenAIConnection(createOpenAIConfig(c));

        case 'zhipu':
            return testZhipuConnection(createZhipuConfig(c));

        case 'alibaba':
            return testAlibabaConnection(createAlibabaConfig(c));

        default:
            console.error(`不支持的 AI 提供商: ${provider}`);
            return false;
    }
}

// ==================== 辅助函数 ====================

/**
 * 获取当前配置的提供商名称
 */
export function getProviderName(provider?: ModelProvider): string {
    const p = provider || (getAppConfig().provider as ModelProvider);
    const names: Record<ModelProvider, string> = {
        google: 'Google Gemini',
        openai: 'OpenAI',
        zhipu: '智谱 AI',
        alibaba: '阿里云百炼'
    };
    return names[p] || '未知';
}

/**
 * 清理 AI 返回的 JSON 字符串
 */
export function cleanJsonResponse(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
        cleaned = cleaned.replace(/\n?```\s*$/, '');
    }
    return cleaned.trim();
}
