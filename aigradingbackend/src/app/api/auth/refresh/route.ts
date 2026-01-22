/**
 * Token 刷新接口
 * POST /api/auth/refresh
 * 
 * 使用 Refresh Token 获取新的 Access Token
 */

import { verifyRefreshToken, signTokenPair, blacklistToken } from '@/lib/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return apiError('缺少 refreshToken', 400, ErrorCode.INVALID_REQUEST);
        }

        // 验证 Refresh Token
        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            return apiError('refreshToken 无效或已过期', 401, ErrorCode.AUTH_TOKEN_INVALID);
        }

        // 将旧的 Refresh Token 加入黑名单 (Rotation 策略)
        blacklistToken(refreshToken);

        // 生成新的 Token 对
        const tokens = signTokenPair({
            userId: payload.userId,
            email: payload.email
        });

        return apiSuccess({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
        }, 'Token 刷新成功');

    } catch (error) {
        console.error('Refresh token error:', error);
        return apiError('Token 刷新失败', 500);
    }
}
