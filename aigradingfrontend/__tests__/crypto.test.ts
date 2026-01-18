/**
 * crypto.ts 工具函数单元测试
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

describe('crypto 加密工具', () => {
    describe('encrypt', () => {
        it('应该对字符串进行加密', () => {
            const plaintext = 'test-api-key-12345';
            const encrypted = encrypt(plaintext);

            expect(encrypted).not.toBe(plaintext);
            expect(encrypted.startsWith('__enc_v1__')).toBe(true);
        });

        it('应该对空字符串返回原值', () => {
            expect(encrypt('')).toBe('');
        });
    });

    describe('decrypt', () => {
        it('应该正确解密已加密的字符串', () => {
            const plaintext = 'my-secret-key';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('应该对非加密字符串返回原值', () => {
            const plaintext = 'not-encrypted';
            expect(decrypt(plaintext)).toBe(plaintext);
        });

        it('应该处理空字符串', () => {
            expect(decrypt('')).toBe('');
        });
    });

    describe('isEncrypted', () => {
        it('应该识别已加密的字符串', () => {
            const encrypted = encrypt('test');
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it('应该识别未加密的字符串', () => {
            expect(isEncrypted('plain-text')).toBe(false);
            expect(isEncrypted('')).toBe(false);
        });
    });
});
