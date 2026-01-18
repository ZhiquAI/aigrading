/**
 * storage.ts 工具函数单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
    storage: {
        local: {
            get: vi.fn((keys, callback) => {
                if (typeof keys === 'string') {
                    callback({ [keys]: mockStorage[keys] });
                } else if (Array.isArray(keys)) {
                    const result: Record<string, unknown> = {};
                    keys.forEach(k => { result[k] = mockStorage[k]; });
                    callback(result);
                } else {
                    callback(mockStorage);
                }
            }),
            set: vi.fn((items, callback) => {
                Object.assign(mockStorage, items);
                callback?.();
            }),
        },
    },
});

import { storage } from '../utils/storage';

describe('storage 工具', () => {
    beforeEach(() => {
        // 清空 mock 存储
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    });

    describe('setItem', () => {
        it('应该保存数据', async () => {
            await storage.setItem('test-key', 'test-value');
            expect(mockStorage['test-key']).toBe('test-value');
        });
    });

    describe('getItem', () => {
        it('应该获取保存的数据', async () => {
            mockStorage['existing-key'] = 'existing-value';
            const value = await storage.getItem('existing-key');
            expect(value).toBe('existing-value');
        });

        it('应该对不存在的键返回 null', async () => {
            const value = await storage.getItem('non-existent');
            // storage 模块对不存在的键返回 null
            expect(value).toBeNull();
        });
    });
});
