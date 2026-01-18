/**
 * CloudBase 额度管理服务
 * 调用后端API进行真实的数据管理
 */

import { initAPIClient, getAPIClient } from './apiClient';
import { getDeviceId } from '../utils/device';

// 自动初始化APIClient
let initialized = false;

async function ensureInitialized() {
    if (!initialized) {
        const deviceId = await getDeviceId();
        initAPIClient(deviceId);
        initialized = true;
    }
}

/**
 * 检查额度
 */
export async function checkQuota(deviceId: string) {
    try {
        await ensureInitialized();
        const client = getAPIClient();
        const response = await client.checkQuota();

        if (!response.success) {
            console.error('[checkQuota] API error:', response.message);
            return {
                canUse: false,
                remaining: 0,
                total: 0,
                used: 0,
                isFirstTime: true,
                message: response.message || '查询额度失败'
            };
        }

        const { remaining, total, used } = response.data;

        if (total === 0) {
            return {
                canUse: false,
                remaining: 0,
                total: 0,
                used: 0,
                isFirstTime: true,
                message: '欢迎使用！请先激活'
            };
        }

        if (remaining <= 0) {
            return {
                canUse: false,
                remaining: 0,
                total,
                used,
                message: '额度已用完，请购买充值'
            };
        }

        return {
            canUse: true,
            remaining,
            total,
            used
        };
    } catch (error) {
        console.error('[checkQuota] Error:', error);
        return {
            canUse: false,
            remaining: 0,
            total: 0,
            used: 0,
            message: '网络错误，请检查后端服务'
        };
    }
}

/**
 * 消耗额度
 */
export async function consumeQuota(deviceId: string, metadata?: any) {
    try {
        await ensureInitialized();
        const client = getAPIClient();
        const response = await client.consumeQuota(metadata);

        if (!response.success) {
            console.error('[consumeQuota] API error:', response.message);
            return {
                success: false,
                message: response.message || '消费额度失败'
            };
        }

        console.log(`[consumeQuota] Success: ${response.data.remaining} remaining`);

        // 触发额度更新事件
        window.dispatchEvent(new CustomEvent('quota_updated', {
            detail: { remaining: response.data.remaining }
        }));

        return {
            success: true,
            message: '额度已扣减',
            remaining: response.data.remaining
        };
    } catch (error) {
        console.error('[consumeQuota] Error:', error);
        return {
            success: false,
            message: '网络错误，请检查后端服务'
        };
    }
}

/**
 * 验证激活码
 */
export async function verifyActivation(code: string, deviceId: string) {
    try {
        await ensureInitialized();
        const client = getAPIClient();
        const formattedCode = code.replace(/\s/g, '').toUpperCase();

        const response = await client.verifyActivation(formattedCode);

        if (!response.success) {
            console.error('[verifyActivation] API error:', response.message);
            return {
                success: false,
                message: response.message || '激活失败'
            };
        }

        const { quotaAdded, remaining, total, codeType } = response.data;

        console.log(`[verifyActivation] Success: +${quotaAdded}, now ${remaining}/${total}`);

        // 触发额度更新事件
        window.dispatchEvent(new CustomEvent('quota_updated', {
            detail: { remaining, total }
        }));

        return {
            success: true,
            message: `激活成功！已充值 ${quotaAdded} 次批改额度`,
            quota: quotaAdded,
            type: codeType,
            remaining,
            total
        };
    } catch (error) {
        console.error('[verifyActivation] Error:', error);
        return {
            success: false,
            message: '网络错误，请检查后端服务'
        };
    }
}

// ========== 管理后台专用API（保留兼容性）==========
// 这些函数现在不再使用，但保留接口以避免破坏现有代码

export function getAllActivationCodes() {
    console.warn('[getAllActivationCodes] This function is deprecated. Use admin backend instead.');
    return [];
}

export function getAllActivationRecords() {
    console.warn('[getAllActivationRecords] This function is deprecated. Use admin backend instead.');
    return [];
}

export function getAllDeviceQuotas() {
    console.warn('[getAllDeviceQuotas] This function is deprecated. Use admin backend instead.');
    return [];
}

export function getAllUsageLogs() {
    console.warn('[getAllUsageLogs] This function is deprecated. Use admin backend instead.');
    return [];
}

export function getStatistics() {
    console.warn('[getStatistics] This function is deprecated. Use admin backend instead.');
    return {
        totalCodes: 0,
        activeCodes: 0,
        totalActivations: 0,
        totalDevices: 0,
        totalUsage: 0,
        totalQuotaRemaining: 0,
        totalQuotaUsed: 0
    };
}

export function createActivationCode() {
    console.warn('[createActivationCode] This function is deprecated. Use admin backend instead.');
    return false;
}

export function disableActivationCode() {
    console.warn('[disableActivationCode] This function is deprecated. Use admin backend instead.');
    return false;
}

export default {
    checkQuota,
    consumeQuota,
    verifyActivation,
    // 已废弃的管理API
    getAllActivationCodes,
    getAllActivationRecords,
    getAllDeviceQuotas,
    getAllUsageLogs,
    getStatistics,
    createActivationCode,
    disableActivationCode
};
