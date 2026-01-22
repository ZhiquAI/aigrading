/**
 * 速率限制器 (Rate Limiter)
 * 
 * 基于滑动窗口算法的内存限流实现
 * 
 * 配置:
 * - AI 批改 API: 10 次/分钟
 * - 其他 API: 100 次/分钟
 * 
 * 使用方式:
 * const limiter = getRateLimiter('ai');
 * const result = limiter.check(clientId);
 * if (!result.allowed) {
 *   return Response.json({ error: 'Too many requests' }, { status: 429 });
 * }
 */

interface RateLimitConfig {
    windowMs: number;      // 时间窗口（毫秒）
    maxRequests: number;   // 窗口内最大请求数
}

interface RequestRecord {
    timestamps: number[];
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;  // 重置时间戳
}

// 预设配置
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    ai: {
        windowMs: 60 * 1000,  // 1 分钟
        maxRequests: 10        // 10 次
    },
    default: {
        windowMs: 60 * 1000,  // 1 分钟
        maxRequests: 100       // 100 次
    },
    auth: {
        windowMs: 15 * 60 * 1000, // 15 分钟
        maxRequests: 10            // 10 次（防止暴力破解）
    }
};

class RateLimiter {
    private records: Map<string, RequestRecord> = new Map();
    private config: RateLimitConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: RateLimitConfig) {
        this.config = config;
        // 定期清理过期记录
        this.startCleanup();
    }

    private startCleanup(): void {
        // 每分钟清理一次过期记录
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000);
    }

    private cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        for (const [key, record] of this.records.entries()) {
            // 过滤掉窗口外的时间戳
            record.timestamps = record.timestamps.filter(ts => ts > windowStart);
            // 如果没有剩余记录，删除该 key
            if (record.timestamps.length === 0) {
                this.records.delete(key);
            }
        }
    }

    /**
     * 检查请求是否允许
     * @param clientId 客户端标识（IP 或设备ID）
     */
    check(clientId: string): RateLimitResult {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // 获取或创建记录
        let record = this.records.get(clientId);
        if (!record) {
            record = { timestamps: [] };
            this.records.set(clientId, record);
        }

        // 过滤掉窗口外的请求
        record.timestamps = record.timestamps.filter(ts => ts > windowStart);

        // 检查是否超过限制
        if (record.timestamps.length >= this.config.maxRequests) {
            // 计算重置时间
            const oldestInWindow = Math.min(...record.timestamps);
            const resetTime = oldestInWindow + this.config.windowMs;

            return {
                allowed: false,
                remaining: 0,
                resetTime
            };
        }

        // 记录本次请求
        record.timestamps.push(now);

        return {
            allowed: true,
            remaining: this.config.maxRequests - record.timestamps.length,
            resetTime: now + this.config.windowMs
        };
    }

    /**
     * 重置某个客户端的限制
     */
    reset(clientId: string): void {
        this.records.delete(clientId);
    }

    /**
     * 获取当前状态（用于监控）
     */
    getStats(): { totalClients: number; config: RateLimitConfig } {
        return {
            totalClients: this.records.size,
            config: this.config
        };
    }

    /**
     * 销毁限制器（清理定时器）
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.records.clear();
    }
}

// 限制器实例缓存
const limiters: Map<string, RateLimiter> = new Map();

/**
 * 获取指定类型的限制器
 * @param type 限制器类型: 'ai' | 'auth' | 'default'
 */
export function getRateLimiter(type: 'ai' | 'auth' | 'default' = 'default'): RateLimiter {
    let limiter = limiters.get(type);
    if (!limiter) {
        const config = RATE_LIMIT_CONFIGS[type] || RATE_LIMIT_CONFIGS.default;
        limiter = new RateLimiter(config);
        limiters.set(type, limiter);
    }
    return limiter;
}

/**
 * 从请求中提取客户端标识
 * 优先使用设备ID，其次使用 IP
 */
export function getClientId(request: Request): string {
    // 优先使用设备 ID
    const deviceId = request.headers.get('x-device-id');
    if (deviceId) {
        return `device:${deviceId}`;
    }

    // 其次使用 IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return `ip:${forwardedFor.split(',')[0].trim()}`;
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return `ip:${realIp}`;
    }

    // 兜底使用随机标识（不推荐）
    return `unknown:${Date.now()}`;
}

/**
 * 检查请求是否被限流
 * 便捷函数，用于 API 路由
 */
export function checkRateLimit(
    request: Request,
    type: 'ai' | 'auth' | 'default' = 'default'
): RateLimitResult & { clientId: string } {
    const clientId = getClientId(request);
    const limiter = getRateLimiter(type);
    const result = limiter.check(clientId);
    return { ...result, clientId };
}

/**
 * 创建限流响应（429）
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

    return new Response(
        JSON.stringify({
            success: false,
            message: '请求过于频繁，请稍后重试',
            retryAfter
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(result.resetTime)
            }
        }
    );
}
