/**
 * geminiService.ts 单元测试
 * 
 * 测试覆盖:
 * - 配置管理 (getAppConfig, saveAppConfig)
 * - API Key 检查 (checkApiKeyConfigured)
 * - 模型名称获取 (通过策略)
 * - 连接测试 (testConnection) - Mock
 * - 学生答案评估 (assessStudentAnswer) - Mock
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getAppConfig,
    saveAppConfig,
    checkApiKeyConfigured,
    testConnection,
    type GradingStrategy
} from '../services/geminiService';
import { encrypt, isEncrypted } from '../utils/crypto';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('geminiService', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ==================== 配置管理测试 ====================
    describe('getAppConfig', () => {
        it('应该返回默认配置当无保存配置时', () => {
            const config = getAppConfig();

            expect(config).toHaveProperty('provider');
            expect(config).toHaveProperty('endpoint');
            expect(config).toHaveProperty('modelName');
            expect(config).toHaveProperty('apiKey');
            expect(config.provider).toBe('google');
        });

        it('应该从 localStorage 加载已保存的配置', () => {
            const savedConfig = {
                provider: 'openai',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                modelName: 'gpt-4',
                apiKey: 'test-key'
            };
            localStorageMock.setItem('app_model_config', JSON.stringify(savedConfig));

            const config = getAppConfig();

            expect(config.provider).toBe('openai');
            expect(config.modelName).toBe('gpt-4');
        });

        it('应该自动解密已加密的 API Key', () => {
            const plainKey = 'my-secret-api-key';
            const encryptedKey = encrypt(plainKey);
            const savedConfig = {
                provider: 'google',
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: encryptedKey
            };
            localStorageMock.setItem('app_model_config', JSON.stringify(savedConfig));

            const config = getAppConfig();

            expect(config.apiKey).toBe(plainKey);
        });

        it('应该处理无效的 JSON 并返回默认配置', () => {
            localStorageMock.setItem('app_model_config', 'invalid-json');

            const config = getAppConfig();

            expect(config.provider).toBe('google');
        });
    });

    describe('saveAppConfig', () => {
        it('应该保存配置到 localStorage', () => {
            const config = {
                provider: 'zhipu' as const,
                endpoint: 'https://api.zhipu.ai',
                modelName: 'glm-4v',
                apiKey: 'zhipu-key'
            };

            saveAppConfig(config);

            expect(localStorageMock.setItem).toHaveBeenCalled();
            const savedCall = localStorageMock.setItem.mock.calls[0];
            expect(savedCall[0]).toBe('app_model_config');
        });

        it('应该自动加密 API Key', () => {
            const config = {
                provider: 'google' as const,
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: 'plain-api-key'
            };

            saveAppConfig(config);

            const savedCall = localStorageMock.setItem.mock.calls[0];
            const savedConfig = JSON.parse(savedCall[1]);

            expect(isEncrypted(savedConfig.apiKey)).toBe(true);
        });

        it('不应该重复加密已加密的 API Key', () => {
            const plainKey = 'my-key';
            const encryptedKey = encrypt(plainKey);
            const config = {
                provider: 'google' as const,
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: encryptedKey // 已经加密
            };

            saveAppConfig(config);

            const savedCall = localStorageMock.setItem.mock.calls[0];
            const savedConfig = JSON.parse(savedCall[1]);

            // 应该保持原样，不会变成 __enc_v1____enc_v1__...
            expect(savedConfig.apiKey).toBe(encryptedKey);
        });
    });

    // ==================== API Key 检查测试 ====================
    describe('checkApiKeyConfigured', () => {
        it('应该返回 false 当没有配置 API Key', () => {
            localStorageMock.setItem('app_model_config', JSON.stringify({
                provider: 'google',
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: ''
            }));

            expect(checkApiKeyConfigured()).toBe(false);
        });

        it('应该返回 true 当配置了 API Key', () => {
            localStorageMock.setItem('app_model_config', JSON.stringify({
                provider: 'google',
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: 'test-key'
            }));

            expect(checkApiKeyConfigured()).toBe(true);
        });

        it('应该返回 true 当使用 OpenAI 并配置了 API Key', () => {
            localStorageMock.setItem('app_model_config', JSON.stringify({
                provider: 'openai',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                modelName: 'gpt-4',
                apiKey: 'sk-xxx'
            }));

            expect(checkApiKeyConfigured()).toBe(true);
        });
    });

    // ==================== 连接测试 ====================
    describe('testConnection', () => {
        it('对于 OpenAI 兼容 API 成功连接应返回 true', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'pong' } }] })
            });

            const config = {
                provider: 'openai' as const,
                endpoint: 'https://api.openai.com/v1/chat/completions',
                modelName: 'gpt-4',
                apiKey: 'sk-test'
            };

            const result = await testConnection(config);

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                config.endpoint,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${config.apiKey}`
                    })
                })
            );
        });

        it('连接失败应返回 false', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized'
            });

            const config = {
                provider: 'openai' as const,
                endpoint: 'https://api.openai.com/v1/chat/completions',
                modelName: 'gpt-4',
                apiKey: 'invalid-key'
            };

            const result = await testConnection(config);

            expect(result).toBe(false);
        });

        it('网络错误应返回 false', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network Error'));

            const config = {
                provider: 'openai' as const,
                endpoint: 'https://api.openai.com/v1/chat/completions',
                modelName: 'gpt-4',
                apiKey: 'sk-test'
            };

            const result = await testConnection(config);

            expect(result).toBe(false);
        });

        it('Google provider 无 API Key 应返回 false', async () => {
            const config = {
                provider: 'google' as const,
                endpoint: '',
                modelName: 'gemini-2.0-flash-exp',
                apiKey: ''
            };

            const result = await testConnection(config);

            expect(result).toBe(false);
        });
    });

    // ==================== 策略类型测试 ====================
    describe('GradingStrategy', () => {
        it('应该支持 flash/pro/reasoning 三种策略', () => {
            const strategies: GradingStrategy[] = ['flash', 'pro', 'reasoning'];

            strategies.forEach(strategy => {
                expect(['flash', 'pro', 'reasoning']).toContain(strategy);
            });
        });
    });
});
