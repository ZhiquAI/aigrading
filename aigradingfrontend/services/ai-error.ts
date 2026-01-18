/**
 * ai-error.ts - AI 服务错误处理
 * 
 * 标准化错误类型和解析逻辑
 */

// ==================== 错误类型枚举 ====================

export enum AIErrorType {
    // 认证错误
    INVALID_API_KEY = 'INVALID_API_KEY',
    API_KEY_EXPIRED = 'API_KEY_EXPIRED',

    // 配额错误
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    RATE_LIMITED = 'RATE_LIMITED',

    // 模型错误
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
    MODEL_OVERLOADED = 'MODEL_OVERLOADED',

    // 请求错误
    INVALID_REQUEST = 'INVALID_REQUEST',
    CONTENT_FILTERED = 'CONTENT_FILTERED',
    CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',

    // 网络错误
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',

    // 服务错误
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

    // 未知错误
    UNKNOWN = 'UNKNOWN'
}

// ==================== 错误信息映射 ====================

export const ERROR_MESSAGES: Record<AIErrorType, string> = {
    [AIErrorType.INVALID_API_KEY]: 'API Key 无效，请检查配置',
    [AIErrorType.API_KEY_EXPIRED]: 'API Key 已过期，请更新',
    [AIErrorType.QUOTA_EXCEEDED]: '额度已用完，请充值或更换 API Key',
    [AIErrorType.RATE_LIMITED]: '请求过于频繁，请稍后重试',
    [AIErrorType.MODEL_NOT_FOUND]: '模型不存在，请检查模型名称',
    [AIErrorType.MODEL_OVERLOADED]: '模型繁忙，请稍后重试',
    [AIErrorType.INVALID_REQUEST]: '请求参数错误',
    [AIErrorType.CONTENT_FILTERED]: '内容被安全过滤器拦截',
    [AIErrorType.CONTEXT_TOO_LONG]: '输入内容过长，请精简后重试',
    [AIErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络',
    [AIErrorType.TIMEOUT]: '请求超时，请重试',
    [AIErrorType.SERVICE_UNAVAILABLE]: 'AI 服务暂时不可用',
    [AIErrorType.UNKNOWN]: '未知错误，请重试'
};

// ==================== 自定义错误类 ====================

export class AIError extends Error {
    type: AIErrorType;
    originalError?: unknown;
    statusCode?: number;

    constructor(type: AIErrorType, message?: string, originalError?: unknown, statusCode?: number) {
        super(message || ERROR_MESSAGES[type]);
        this.name = 'AIError';
        this.type = type;
        this.originalError = originalError;
        this.statusCode = statusCode;
    }

    /**
     * 获取用户友好的错误信息
     */
    getUserMessage(): string {
        return ERROR_MESSAGES[this.type] || this.message;
    }
}

// ==================== 错误解析函数 ====================

/**
 * 从 HTTP 状态码和响应内容解析错误类型
 */
export function parseAPIError(statusCode: number, responseBody?: any): AIError {
    const errorMessage = responseBody?.error?.message || responseBody?.message || '';

    // 根据状态码判断
    switch (statusCode) {
        case 401:
            return new AIError(AIErrorType.INVALID_API_KEY, errorMessage, responseBody, statusCode);
        case 403:
            if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
                return new AIError(AIErrorType.QUOTA_EXCEEDED, errorMessage, responseBody, statusCode);
            }
            return new AIError(AIErrorType.INVALID_API_KEY, errorMessage, responseBody, statusCode);
        case 404:
            if (errorMessage.includes('model')) {
                return new AIError(AIErrorType.MODEL_NOT_FOUND, errorMessage, responseBody, statusCode);
            }
            return new AIError(AIErrorType.INVALID_REQUEST, errorMessage, responseBody, statusCode);
        case 429:
            return new AIError(AIErrorType.RATE_LIMITED, errorMessage, responseBody, statusCode);
        case 500:
        case 502:
        case 503:
            return new AIError(AIErrorType.SERVICE_UNAVAILABLE, errorMessage, responseBody, statusCode);
        case 504:
            return new AIError(AIErrorType.TIMEOUT, errorMessage, responseBody, statusCode);
    }

    // 根据错误消息内容判断
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('api key') || lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
        return new AIError(AIErrorType.INVALID_API_KEY, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('quota') || lowerMessage.includes('billing') || lowerMessage.includes('exceeded')) {
        return new AIError(AIErrorType.QUOTA_EXCEEDED, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
        return new AIError(AIErrorType.RATE_LIMITED, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('model') && (lowerMessage.includes('not found') || lowerMessage.includes('does not exist'))) {
        return new AIError(AIErrorType.MODEL_NOT_FOUND, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('overloaded') || lowerMessage.includes('capacity')) {
        return new AIError(AIErrorType.MODEL_OVERLOADED, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('content') && (lowerMessage.includes('filter') || lowerMessage.includes('safety') || lowerMessage.includes('blocked'))) {
        return new AIError(AIErrorType.CONTENT_FILTERED, errorMessage, responseBody, statusCode);
    }

    if (lowerMessage.includes('context') || lowerMessage.includes('token') || lowerMessage.includes('too long')) {
        return new AIError(AIErrorType.CONTEXT_TOO_LONG, errorMessage, responseBody, statusCode);
    }

    return new AIError(AIErrorType.UNKNOWN, errorMessage || `HTTP ${statusCode}`, responseBody, statusCode);
}

/**
 * 从网络错误解析
 */
export function parseNetworkError(error: unknown): AIError {
    if (error instanceof AIError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('timeout') || lowerMessage.includes('aborted')) {
        return new AIError(AIErrorType.TIMEOUT, errorMessage, error);
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
        return new AIError(AIErrorType.NETWORK_ERROR, errorMessage, error);
    }

    return new AIError(AIErrorType.UNKNOWN, errorMessage, error);
}
