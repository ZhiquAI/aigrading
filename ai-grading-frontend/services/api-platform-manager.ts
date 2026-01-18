/**
 * API 平台管理器
 * 支持多平台切换、成本监控和故障转移
 */

import { AppConfig, ModelProviderType } from "../types";
import { encrypt, decrypt, isEncrypted } from "../utils/crypto";

// ==================== 平台配置 ====================

export type PlatformName = 'gptsapi' | 'cherryin' | 'laozhang' | 'dmxapi' | 'poloapi' | 'google-direct';

export interface PlatformConfig {
    name: PlatformName;
    displayName: string;
    baseUrl: string;
    apiKey: string;
    provider: ModelProviderType;

    // 定价信息 (元/百万tokens)
    pricing: {
        'gpt-4o': number;
        'gpt-4o-mini': number;
        'gemini-2.5-flash': number;
        'gemini-3-flash-preview': number;
        'gemini-3-pro-preview': number;
        'claude-3.5-sonnet': number;
    };

    // 平台特性
    features: {
        streaming: boolean;          // 是否支持流式输出
        gemini: boolean;             // 是否支持 Gemini
        claude: boolean;             // 是否支持 Claude
        imageSupport: boolean;       // 是否支持图片输入
    };

    // 性能指标(毫秒)
    performance: {
        avgLatency: number;          // 平均延迟
        reliability: number;         // 可靠性 (0-1)
    };
}

// 平台配置表
export const PLATFORM_CONFIGS: Record<PlatformName, Omit<PlatformConfig, 'apiKey'>> = {
    'gptsapi': {
        name: 'gptsapi',
        displayName: 'GPTsAPI (当前)',
        baseUrl: 'https://gptsapi.net/v1',
        provider: 'openai',
        pricing: {
            'gpt-4o': 4.5,
            'gpt-4o-mini': 0.9,
            'gemini-2.5-flash': 0.8,
            'gemini-3-flash-preview': 1.2,
            'gemini-3-pro-preview': 3.5,
            'claude-3.5-sonnet': 5.0,
        },
        features: {
            streaming: true,
            gemini: true,
            claude: true,
            imageSupport: true,
        },
        performance: {
            avgLatency: 2000,
            reliability: 0.95,
        }
    },

    'cherryin': {
        name: 'cherryin',
        displayName: 'CherryIN (测试期8折)',
        baseUrl: 'https://open.cherryin.ai/v1',
        provider: 'openai',
        pricing: {
            'gpt-4o': 4.0,           // 9折
            'gpt-4o-mini': 0.8,
            'gemini-2.5-flash': 0.64, // 8折 (最优)
            'gemini-3-flash-preview': 0.96,
            'gemini-3-pro-preview': 2.8,
            'claude-3.5-sonnet': 3.5, // 7折
        },
        features: {
            streaming: true,
            gemini: true,
            claude: true,
            imageSupport: true,
        },
        performance: {
            avgLatency: 1800,
            reliability: 0.92,  // 新平台,待验证
        }
    },

    'laozhang': {
        name: 'laozhang',
        displayName: '老张AI (教育优惠)',
        baseUrl: 'https://api.laozhang.ai/v1',
        provider: 'openai',
        pricing: {
            'gpt-4o': 3.2,           // 约7折
            'gpt-4o-mini': 0.7,
            'gemini-2.5-flash': 0.75,
            'gemini-3-flash-preview': 1.1,
            'gemini-3-pro-preview': 3.0,
            'claude-3.5-sonnet': 3.8,
        },
        features: {
            streaming: true,
            gemini: true,
            claude: true,
            imageSupport: true,
        },
        performance: {
            avgLatency: 1500,
            reliability: 0.99,      // 宣称99.9%
        }
    },

    'dmxapi': {
        name: 'dmxapi',
        displayName: 'DMXAPI (企业级)',
        baseUrl: 'https://api.dmxapi.cn/v1',
        provider: 'openai',
        pricing: {
            'gpt-4o': 3.0,           // 约6.8折
            'gpt-4o-mini': 0.65,
            'gemini-2.5-flash': 0.7,
            'gemini-3-flash-preview': 1.0,
            'gemini-3-pro-preview': 2.8,
            'claude-3.5-sonnet': 3.5,
        },
        features: {
            streaming: true,
            gemini: true,
            claude: true,
            imageSupport: true,
        },
        performance: {
            avgLatency: 1600,
            reliability: 0.99,      // 企业级SLA
        }
    },

    'poloapi': {
        name: 'poloapi',
        displayName: 'Poloapi (性价比之王)',
        baseUrl: 'https://api.poloapi.top/v1',
        provider: 'openai',
        pricing: {
            'gpt-4o': 2.7,           // 约3折
            'gpt-4o-mini': 0.5,
            'gemini-2.5-flash': 0.65,
            'gemini-3-flash-preview': 0.9,
            'gemini-3-pro-preview': 2.5,
            'claude-3.5-sonnet': 3.0,
        },
        features: {
            streaming: true,
            gemini: true,
            claude: true,
            imageSupport: true,
        },
        performance: {
            avgLatency: 2200,
            reliability: 0.90,
        }
    },

    'google-direct': {
        name: 'google-direct',
        displayName: 'Google 直连 (需VPN)',
        baseUrl: '',
        provider: 'google',
        pricing: {
            'gpt-4o': 0,
            'gpt-4o-mini': 0,
            'gemini-2.5-flash': 0.35,  // 官方价
            'gemini-3-flash-preview': 0.8,
            'gemini-3-pro-preview': 2.5,
            'claude-3.5-sonnet': 0,
        },
        features: {
            streaming: true,
            gemini: true,
            claude: false,
            imageSupport: true,
        },
        performance: {
            avgLatency: 1200,
            reliability: 0.98,
        }
    }
};

// ==================== 本地存储 ====================

const STORAGE_KEY_PLATFORMS = 'api_platforms_config';
const STORAGE_KEY_ACTIVE = 'api_active_platform';
const STORAGE_KEY_USAGE = 'api_usage_stats';

// 平台配置(含API Key)
export interface StoredPlatformConfig extends PlatformConfig {
    enabled: boolean;  // 是否启用此平台
}

/**
 * 获取所有已配置的平台
 */
export const getAllPlatforms = (): Record<PlatformName, StoredPlatformConfig> => {
    const saved = localStorage.getItem(STORAGE_KEY_PLATFORMS);
    if (saved) {
        try {
            const configs = JSON.parse(saved);
            // 解密 API Keys
            Object.values(configs).forEach((config: any) => {
                if (config.apiKey && isEncrypted(config.apiKey)) {
                    config.apiKey = decrypt(config.apiKey);
                }
            });
            return configs;
        } catch (e) {
            console.error('[getAllPlatforms] Parse error:', e);
        }
    }

    // 返回默认配置(空API Key)
    const defaults: Record<PlatformName, StoredPlatformConfig> = {} as any;
    Object.entries(PLATFORM_CONFIGS).forEach(([name, config]) => {
        defaults[name as PlatformName] = {
            ...config,
            apiKey: '',
            enabled: false,
        };
    });
    return defaults;
};

/**
 * 保存平台配置
 */
export const savePlatformConfig = (name: PlatformName, config: Partial<StoredPlatformConfig>) => {
    const all = getAllPlatforms();

    // 更新配置
    all[name] = {
        ...all[name],
        ...config,
    };

    // 加密 API Key
    if (all[name].apiKey && !isEncrypted(all[name].apiKey)) {
        all[name].apiKey = encrypt(all[name].apiKey);
    }

    localStorage.setItem(STORAGE_KEY_PLATFORMS, JSON.stringify(all));
};

/**
 * 获取当前激活的平台
 */
export const getActivePlatform = (): PlatformName => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE);
    return (saved as PlatformName) || 'gptsapi';
};

/**
 * 设置激活平台
 */
export const setActivePlatform = (name: PlatformName) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, name);

    // 触发平台切换事件
    window.dispatchEvent(new CustomEvent('platform_changed', { detail: { platform: name } }));
};

/**
 * 获取当前平台的完整配置
 */
export const getCurrentPlatformConfig = (): StoredPlatformConfig => {
    const activeName = getActivePlatform();
    const all = getAllPlatforms();
    return all[activeName];
};

/**
 * 转换为 AppConfig 格式(兼容现有代码)
 */
export const toAppConfig = (platform: StoredPlatformConfig): AppConfig => {
    return {
        provider: platform.provider,
        endpoint: platform.baseUrl,
        modelName: 'gemini-2.5-flash',  // 默认模型
        apiKey: platform.apiKey,
    };
};

// ==================== 使用统计 ====================

export interface UsageRecord {
    platform: PlatformName;
    model: string;
    timestamp: number;
    tokens: number;         // 使用的 tokens
    cost: number;           // 花费(元)
    latency: number;        // 延迟(毫秒)
    success: boolean;       // 是否成功
}

/**
 * 记录API使用
 */
export const recordUsage = (record: UsageRecord) => {
    const saved = localStorage.getItem(STORAGE_KEY_USAGE);
    let records: UsageRecord[] = [];

    if (saved) {
        try {
            records = JSON.parse(saved);
        } catch (e) {
            console.error('[recordUsage] Parse error:', e);
        }
    }

    records.push(record);

    // 只保留最近7天的记录
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    records = records.filter(r => r.timestamp > sevenDaysAgo);

    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(records));
};

/**
 * 获取使用统计
 */
export const getUsageStats = (days: number = 7) => {
    const saved = localStorage.getItem(STORAGE_KEY_USAGE);
    if (!saved) return [];

    try {
        const records: UsageRecord[] = JSON.parse(saved);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return records.filter(r => r.timestamp > cutoff);
    } catch (e) {
        console.error('[getUsageStats] Parse error:', e);
        return [];
    }
};

/**
 * 计算平台成本对比
 */
export const getPlatformCostComparison = (model: string = 'gemini-2.5-flash') => {
    const platforms = Object.values(PLATFORM_CONFIGS);

    return platforms
        .map(p => ({
            name: p.displayName,
            cost: (p.pricing as any)[model] || 0,
            reliability: p.performance.reliability,
            latency: p.performance.avgLatency,
        }))
        .sort((a, b) => a.cost - b.cost);
};

/**
 * 预估月度成本
 */
export const estimateMonthlyCost = (
    platform: PlatformName,
    model: string,
    dailyRequests: number,
    avgTokensPerRequest: number
) => {
    const config = PLATFORM_CONFIGS[platform];
    const pricePerMillion = (config.pricing as any)[model] || 0;

    const tokensPerDay = dailyRequests * avgTokensPerRequest;
    const tokensPerMonth = tokensPerDay * 30;
    const costPerMonth = (tokensPerMonth / 1_000_000) * pricePerMillion;

    return {
        platform: config.displayName,
        tokensPerMonth,
        costPerMonth: costPerMonth.toFixed(2),
        costPerYear: (costPerMonth * 12).toFixed(2),
    };
};

// ==================== 故障转移 ====================

/**
 * 获取备用平台列表(按优先级排序)
 */
export const getBackupPlatforms = (): PlatformName[] => {
    const all = getAllPlatforms();
    const current = getActivePlatform();

    // 获取所有已启用且有API Key的平台
    return Object.entries(all)
        .filter(([name, config]) =>
            name !== current &&
            config.enabled &&
            config.apiKey
        )
        .sort((a, b) => b[1].performance.reliability - a[1].performance.reliability)
        .map(([name]) => name as PlatformName);
};

/**
 * 自动故障转移
 */
export const performFailover = async (): Promise<PlatformName | null> => {
    const backups = getBackupPlatforms();

    if (backups.length === 0) {
        console.error('[performFailover] No backup platforms available');
        return null;
    }

    const fallback = backups[0];
    console.log(`[performFailover] Switching to backup platform: ${fallback}`);
    setActivePlatform(fallback);

    return fallback;
};

// ==================== 导出兼容接口 ====================

/**
 * 向后兼容:获取当前配置为 AppConfig 格式
 */
export const getAppConfig = (): AppConfig => {
    const platform = getCurrentPlatformConfig();
    return toAppConfig(platform);
};

/**
 * 向后兼容:保存配置
 */
export const saveAppConfig = (config: AppConfig): void => {
    const activeName = getActivePlatform();
    savePlatformConfig(activeName, {
        provider: config.provider,
        baseUrl: config.endpoint,
        apiKey: config.apiKey,
        enabled: true,
    });
};
