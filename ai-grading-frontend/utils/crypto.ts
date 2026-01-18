/**
 * 安全加密工具 - 用于 API Key 等敏感数据的混淆存储
 * 使用 XOR 混淆 + Base64 编码（同步实现，兼容现有代码）
 * 
 * 注意：这不是加密级别的安全，但比明文存储更安全
 * 可以防止简单的浏览器工具直接查看，但无法防止专业逆向
 */

// 混淆密钥（基于扩展标识符）
const getObfuscationKey = (): string => {
    // 使用扩展 ID 或固定标识符
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        return chrome.runtime.id;
    }
    return 'ai-grading-assistant-key';
};

// 加密前缀标识
const ENCRYPTED_PREFIX = '__enc_v1__';

/**
 * XOR 混淆
 */
function xorObfuscate(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
            text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
    }
    return result;
}

/**
 * 混淆文本数据（同步）
 * @param plaintext 明文
 * @returns 混淆后的字符串
 */
export function encrypt(plaintext: string): string {
    if (!plaintext) return '';

    try {
        const key = getObfuscationKey();
        const obfuscated = xorObfuscate(plaintext, key);
        // Base64 编码，添加前缀标识
        return ENCRYPTED_PREFIX + btoa(unescape(encodeURIComponent(obfuscated)));
    } catch (error) {
        console.error('[Crypto] Encryption failed:', error);
        return plaintext; // 回退到明文
    }
}

/**
 * 解混淆数据（同步）
 * @param ciphertext 混淆后的字符串
 * @returns 明文
 */
export function decrypt(ciphertext: string): string {
    if (!ciphertext) return '';

    // 检查是否为混淆数据
    if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
        return ciphertext; // 返回原文（兼容旧数据）
    }

    try {
        const key = getObfuscationKey();
        const base64Data = ciphertext.slice(ENCRYPTED_PREFIX.length);
        const obfuscated = decodeURIComponent(escape(atob(base64Data)));
        return xorObfuscate(obfuscated, key); // XOR 是可逆的
    } catch (error) {
        console.error('[Crypto] Decryption failed:', error);
        return ciphertext; // 回退返回原文
    }
}

/**
 * 检查是否为混淆数据
 */
export function isEncrypted(data: string): boolean {
    return data?.startsWith(ENCRYPTED_PREFIX) || false;
}
