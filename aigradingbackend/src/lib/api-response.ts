/**
 * 统一 API 响应格式
 */

import { NextResponse } from 'next/server';

/**
 * 错误码体系
 * 
 * 范围分配:
 * - 1000-1999: 认证相关
 * - 2000-2999: 配额相关
 * - 3000-3999: AI 服务相关
 * - 4000-4999: 业务逻辑
 * - 5000-5999: 系统错误
 */
export enum ErrorCode {
    // 认证相关 1000-1999
    AUTH_TOKEN_MISSING = 1001,
    AUTH_TOKEN_EXPIRED = 1002,
    AUTH_TOKEN_INVALID = 1003,
    AUTH_INSUFFICIENT_PERMISSION = 1004,
    AUTH_ACTIVATION_CODE_MISSING = 1005,
    AUTH_ACTIVATION_CODE_INVALID = 1006,

    // 配额相关 2000-2999
    QUOTA_EXHAUSTED = 2001,
    QUOTA_DEVICE_NOT_FOUND = 2002,
    QUOTA_ACTIVATION_FAILED = 2003,

    // AI 服务相关 3000-3999
    AI_SERVICE_UNAVAILABLE = 3001,
    AI_TIMEOUT = 3002,
    AI_PARSE_ERROR = 3003,
    AI_RATE_LIMITED = 3004,

    // 业务逻辑 4000-4999
    RUBRIC_NOT_FOUND = 4001,
    RUBRIC_FORMAT_INVALID = 4002,
    RECORD_NOT_FOUND = 4003,
    INVALID_REQUEST = 4004,

    // 系统错误 5000-5999
    INTERNAL_ERROR = 5001,
    DATABASE_ERROR = 5002,
    RATE_LIMITED = 5003
}

// 成功响应
export function apiSuccess<T>(data: T, message = 'Success') {
    return NextResponse.json(
        {
            success: true,
            message,
            data,
        },
        { status: 200 }
    );
}

// 创建成功响应 (201)
export function apiCreated<T>(data: T, message = 'Created') {
    return NextResponse.json(
        {
            success: true,
            message,
            data,
        },
        { status: 201 }
    );
}

// 错误响应
export function apiError(message: string, status = 400, errorCode?: ErrorCode) {
    return NextResponse.json(
        {
            success: false,
            message,
            data: null,
            ...(errorCode && { errorCode })
        },
        { status }
    );
}

// 速率限制响应 (429)
export function apiRateLimited(retryAfter: number, message = '请求过于频繁，请稍后重试') {
    return new NextResponse(
        JSON.stringify({
            success: false,
            message,
            data: null,
            errorCode: ErrorCode.RATE_LIMITED,
            retryAfter
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter)
            }
        }
    );
}

// 未授权响应 (401)
export function apiUnauthorized(message = '未登录或登录已过期') {
    return apiError(message, 401);
}

// 禁止访问响应 (403)
export function apiForbidden(message = '没有权限访问') {
    return apiError(message, 403);
}

// 未找到响应 (404)
export function apiNotFound(message = '资源不存在') {
    return apiError(message, 404);
}

// 服务器错误响应 (500)
export function apiServerError(message = '服务器内部错误') {
    return apiError(message, 500);
}
