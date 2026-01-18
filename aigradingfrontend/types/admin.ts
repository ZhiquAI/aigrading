/**
 * 管理后台类型定义
 */

export interface ActivationCode {
    code: string;
    type: 'trial' | 'basic' | 'pro' | 'permanent';
    quota: number;
    reusable: boolean;
    maxDevices: number;
    status: 'active' | 'disabled';
    createdAt: string;
    expiresAt?: string;
}

export interface ActivationRecord {
    code: string;
    deviceId: string;
    activatedAt: string;
    quotaAdded: number;
}

export interface DeviceQuota {
    deviceId: string;
    remaining: number;
    total: number;
    used: number;
}

export interface UsageLog {
    deviceId: string;
    usedAt: string;
    metadata?: {
        questionType?: string;
        model?: string;
    };
}

export interface Statistics {
    totalCodes: number;
    activeCodes: number;
    totalActivations: number;
    totalDevices: number;
    totalUsage: number;
    totalQuotaRemaining: number;
    totalQuotaUsed: number;
}
