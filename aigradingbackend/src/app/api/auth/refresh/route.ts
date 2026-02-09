/**
 * Token 刷新接口
 * POST /api/auth/refresh
 * 
 * 使用 Refresh Token 获取新的 Access Token
 */

import { verifyRefreshToken, signTokenPair } from '@/lib/auth';
import { findValidRefreshToken, revokeRefreshToken, storeRefreshToken } from '@/lib/refresh-token';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return apiError('缺少 refreshToken', 400, ErrorCode.INVALID_REQUEST);
        }

        // 验证 Refresh Token（签名与过期）
        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            return apiError('refreshToken 无效或已过期', 401, ErrorCode.AUTH_TOKEN_INVALID);
        }
        if (!payload.role) {
            return apiError('refreshToken 无效，请重新登录', 401, ErrorCode.AUTH_TOKEN_INVALID);
        }

        // 校验 Refresh Token 是否存在且未撤销
        const record = await findValidRefreshToken(refreshToken);
        if (!record) {
            return apiError('refreshToken 已失效，请重新登录', 401, ErrorCode.AUTH_TOKEN_INVALID);
        }
        if (record.userId !== payload.userId) {
            return apiError('refreshToken 无效，请重新登录', 401, ErrorCode.AUTH_TOKEN_INVALID);
        }

        // Rotation: 撤销旧 token
        await revokeRefreshToken(refreshToken);

        // 生成新的 Token 对
        const tokens = signTokenPair({
            userId: payload.userId,
            email: payload.email,
            role: payload.role
        });

        // 持久化新的 refresh token
        await storeRefreshToken(payload.userId, tokens.refreshToken);

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
