import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CORS 中间件
 * 
 * 支持：
 * - Chrome 扩展 (chrome-extension://)
 * - 本地开发 (localhost, 127.0.0.1)
 * - 生产环境自定义域名 (通过 ALLOWED_ORIGINS 环境变量配置)
 * 
 * 环境变量：
 * - ALLOWED_ORIGINS: 逗号分隔的允许域名列表
 *   例如: "https://example.com,https://app.example.com"
 */

// 解析允许的 origins
function getAllowedOrigins(): string[] {
    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
        return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
    }
    return [];
}

// 检查 origin 是否允许
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;

    // Chrome 扩展始终允许
    if (origin.startsWith('chrome-extension://')) {
        return true;
    }

    // 本地开发始终允许
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return true;
    }

    // 检查环境变量配置的允许列表
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
        return true;
    }

    // 开发模式下更宽松
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    return false;
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    const isAllowed = isOriginAllowed(origin);

    // 处理 CORS
    if (isAllowed) {
        const response = NextResponse.next();

        // 设置 CORS 头
        response.headers.set('Access-Control-Allow-Origin', origin || '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers',
            'Content-Type, X-Device-ID, X-Activation-Code, Authorization');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Max-Age', '86400');

        // 处理 OPTIONS 预检请求
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, { status: 200, headers: response.headers });
        }

        return response;
    }

    // 非允许的 origin，继续处理但不设置 CORS 头
    return NextResponse.next();
}

export const config = {
    // 匹配所有 API 路由
    matcher: [
        '/api/:path*',
    ],
};
