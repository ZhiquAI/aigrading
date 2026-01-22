/**
 * 结构化日志服务 (Logger)
 * 
 * 功能:
 * - JSON 格式输出
 * - 日志级别控制 (DEBUG/INFO/WARN/ERROR)
 * - 请求追踪 ID
 * - 敏感信息脱敏
 * - 延迟统计
 * 
 * 使用方式:
 * import { logger, createRequestLogger } from '@/lib/logger';
 * 
 * // 简单日志
 * logger.info('User logged in', { userId: '123' });
 * 
 * // 请求级别日志（带追踪ID）
 * const reqLogger = createRequestLogger(request);
 * reqLogger.info('Processing request');
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    traceId?: string;
    service: string;
    message: string;
    data?: Record<string, unknown>;
    latency?: number;
}

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 默认配置
const CONFIG = {
    service: 'ai-grading-backend',
    minLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
    sensitiveFields: ['password', 'token', 'apiKey', 'activationCode', 'deviceId']
};

/**
 * 脱敏处理
 * 将敏感字段的值替换为掩码
 */
function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        if (CONFIG.sensitiveFields.some(field =>
            key.toLowerCase().includes(field.toLowerCase())
        )) {
            // 脱敏处理
            if (typeof value === 'string' && value.length > 0) {
                masked[key] = value.slice(0, 3) + '***' + value.slice(-3);
            } else {
                masked[key] = '***';
            }
        } else if (typeof value === 'object' && value !== null) {
            // 递归处理嵌套对象
            masked[key] = maskSensitiveData(value as Record<string, unknown>);
        } else {
            masked[key] = value;
        }
    }

    return masked;
}

/**
 * 生成追踪 ID
 */
function generateTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 格式化并输出日志
 */
function log(level: LogLevel, message: string, data?: Record<string, unknown>, traceId?: string): void {
    // 检查日志级别
    if (LOG_LEVELS[level] < LOG_LEVELS[CONFIG.minLevel]) {
        return;
    }

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        service: CONFIG.service,
        message
    };

    if (traceId) {
        entry.traceId = traceId;
    }

    if (data) {
        entry.data = maskSensitiveData(data);
    }

    // JSON 格式输出
    const output = JSON.stringify(entry);

    switch (level) {
        case 'ERROR':
            console.error(output);
            break;
        case 'WARN':
            console.warn(output);
            break;
        case 'DEBUG':
            console.debug(output);
            break;
        default:
            console.log(output);
    }
}

/**
 * 全局日志器
 */
export const logger = {
    debug: (message: string, data?: Record<string, unknown>) => log('DEBUG', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('INFO', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('WARN', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('ERROR', message, data)
};

/**
 * 请求级别日志器
 * 带有追踪 ID 和延迟统计
 */
export function createRequestLogger(request?: Request) {
    const traceId = generateTraceId();
    const startTime = Date.now();

    // 从请求中提取信息
    const requestInfo: Record<string, unknown> = {};
    if (request) {
        requestInfo.method = request.method;
        requestInfo.url = new URL(request.url).pathname;
        requestInfo.deviceId = request.headers.get('x-device-id');
        requestInfo.activationCode = request.headers.get('x-activation-code');
    }

    return {
        traceId,

        debug: (message: string, data?: Record<string, unknown>) =>
            log('DEBUG', message, { ...requestInfo, ...data }, traceId),

        info: (message: string, data?: Record<string, unknown>) =>
            log('INFO', message, { ...requestInfo, ...data }, traceId),

        warn: (message: string, data?: Record<string, unknown>) =>
            log('WARN', message, { ...requestInfo, ...data }, traceId),

        error: (message: string, data?: Record<string, unknown>) =>
            log('ERROR', message, { ...requestInfo, ...data }, traceId),

        /**
         * 记录请求完成，包含延迟
         */
        complete: (message: string, data?: Record<string, unknown>) => {
            const latency = Date.now() - startTime;
            log('INFO', message, {
                ...requestInfo,
                ...data,
                latencyMs: latency
            }, traceId);
        },

        /**
         * 获取当前延迟（毫秒）
         */
        getLatency: () => Date.now() - startTime
    };
}

/**
 * API 日志装饰器（用于包装 API handler）
 */
export function withLogging<T>(
    handler: (request: Request, logger: ReturnType<typeof createRequestLogger>) => Promise<T>
) {
    return async (request: Request): Promise<T> => {
        const reqLogger = createRequestLogger(request);
        reqLogger.info('Request started');

        try {
            const result = await handler(request, reqLogger);
            reqLogger.complete('Request completed');
            return result;
        } catch (error) {
            reqLogger.error('Request failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    };
}
