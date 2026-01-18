/**
 * 统一 API 响应格式
 */

import { NextResponse } from 'next/server';

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
export function apiError(message: string, status = 400) {
    return NextResponse.json(
        {
            success: false,
            message,
            data: null,
        },
        { status }
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
