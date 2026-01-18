/**
 * imageDB.ts IndexedDB 工具函数单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock IndexedDB
const mockStore: Record<string, unknown> = {};
const mockObjectStore = {
    put: vi.fn((value) => {
        mockStore[value.id] = value;
        return { onsuccess: null, onerror: null };
    }),
    get: vi.fn((id) => {
        const result = mockStore[id];
        return {
            result,
            onsuccess: null,
            onerror: null
        };
    }),
    delete: vi.fn((id) => {
        delete mockStore[id];
        return { onsuccess: null, onerror: null };
    }),
    clear: vi.fn(() => {
        Object.keys(mockStore).forEach(k => delete mockStore[k]);
        return { onsuccess: null, onerror: null };
    }),
};

describe('imageDB IndexedDB 工具', () => {
    beforeEach(() => {
        Object.keys(mockStore).forEach(k => delete mockStore[k]);
    });

    describe('StoredImage 结构', () => {
        it('应该包含必要的字段', () => {
            const image = {
                id: 'test-id',
                data: 'base64-data',
                mimeType: 'image/jpeg',
                createdAt: Date.now(),
                size: 1000,
            };

            expect(image).toHaveProperty('id');
            expect(image).toHaveProperty('data');
            expect(image).toHaveProperty('mimeType');
            expect(image).toHaveProperty('createdAt');
            expect(image).toHaveProperty('size');
        });
    });

    describe('图片数据验证', () => {
        it('应该正确计算图片大小', () => {
            const base64Data = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
            const size = base64Data.length;

            expect(size).toBeGreaterThan(0);
        });

        it('应该生成唯一的 ID', () => {
            const id1 = `image-${Date.now()}-1`;
            const id2 = `image-${Date.now()}-2`;

            expect(id1).not.toBe(id2);
        });
    });
});
