/**
 * 用户信息接口
 * GET /api/user/profile - 获取当前用户信息
 */

import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { apiSuccess, apiUnauthorized, apiNotFound, apiServerError } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        // 获取 Token
        const authHeader = request.headers.get('authorization');
        const token = extractToken(authHeader);

        if (!token) {
            return apiUnauthorized();
        }

        // 验证 Token
        const payload = verifyToken(token);

        if (!payload) {
            return apiUnauthorized();
        }

        // 查询用户
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
            },
        });

        if (!user) {
            return apiNotFound('用户不存在');
        }

        return apiSuccess(user);
    } catch (error) {
        console.error('Get profile error:', error);
        return apiServerError('获取用户信息失败');
    }
}
