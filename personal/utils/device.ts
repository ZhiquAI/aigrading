/**
 * 设备指纹生成工具
 * 用于唯一标识用户设备
 */

/**
 * 生成设备指纹
 */
function generateFingerprint(): string {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        new Date().getTimezoneOffset().toString(),
        navigator.hardwareConcurrency?.toString() || '',
        navigator.platform
    ];

    const data = components.join('|');

    // 简单哈希
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
}

/**
 * 获取或创建设备ID
 */
export function getDeviceId(): string {
    const STORAGE_KEY = 'device_id';

    // 尝试从 localStorage 获取
    let deviceId = localStorage.getItem(STORAGE_KEY);

    if (!deviceId) {
        // 生成新ID: 指纹 + 随机数
        const fingerprint = generateFingerprint();
        const random = Math.random().toString(36).substring(2, 10);
        deviceId = `${fingerprint}-${random}`;

        localStorage.setItem(STORAGE_KEY, deviceId);
        console.log('[Device] 新设备ID已创建:', deviceId);
    }

    return deviceId;
}

/**
 * 重置设备ID（仅调试用）
 */
export function resetDeviceId(): void {
    localStorage.removeItem('device_id');
    console.log('[Device] 设备ID已重置');
}
