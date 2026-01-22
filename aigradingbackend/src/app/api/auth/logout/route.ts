/**
 * 登出接口
 * POST /api/auth/logout
 * 
 * 将当前 Token 加入黑名单，使其失效
 */

import { extractToken, blacklistToken, verifyToken } from '@/lib/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = extractToken(authHeader);

        if (!token) {
            return apiError('未提供认证令牌', 401, ErrorCode.AUTH_TOKEN_MISSING);
        }

        // 验证 Token 是否有效（可选，即使无效也可以登出）
        const payload = verifyToken(token);
        if (!payload) {
            // Token 已失效，返回成功（幂等性）
            return apiSuccess(null, '已登出');
        }

        // 将 Token 加入黑名单
        blacklistToken(token);

        // 如果请求体中有 refreshToken，也加入黑名单
        try {
            const body = await request.json();
            if (body.refreshToken) {
                blacklistToken(body.refreshToken);
            }
        } catch {
            // 没有请求体或解析失败，忽略
        }

        return apiSuccess(null, '登出成功');

    } catch (error) {
        console.error('Logout error:', error);
        return apiError('登出失败', 500);
    }
}
