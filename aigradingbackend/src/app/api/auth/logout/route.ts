/**
 * 登出接口
 * POST /api/auth/logout
 * 
 * 将当前 Token 加入黑名单，使其失效
 */

import { revokeRefreshToken } from '@/lib/refresh-token';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        let body: { refreshToken?: string } = {};
        try {
            body = await request.json();
        } catch {
            return apiError('请求体无效', 400, ErrorCode.INVALID_REQUEST);
        }

        const { refreshToken } = body;

        if (!refreshToken) {
            return apiError('缺少 refreshToken', 400, ErrorCode.INVALID_REQUEST);
        }

        await revokeRefreshToken(refreshToken);

        return apiSuccess(null, '登出成功');

    } catch (error) {
        console.error('Logout error:', error);
        return apiError('登出失败', 500);
    }
}
