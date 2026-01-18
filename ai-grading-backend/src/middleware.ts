import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');

    // 允许的origins
    const isExtension = origin?.startsWith('chrome-extension://');
    const isLocalhost = origin?.includes('localhost') || origin?.includes('127.0.0.1');
    const isDevelopment = process.env.NODE_ENV === 'development';

    // 处理CORS
    if ((isExtension || isLocalhost) && isDevelopment) {
        const response = NextResponse.next();

        // 设置CORS头
        response.headers.set('Access-Control-Allow-Origin', origin || '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-ID, Authorization');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Max-Age', '86400');

        // 处理 OPTIONS 预检请求
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, { status: 200, headers: response.headers });
        }

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/client/:path*',
};
