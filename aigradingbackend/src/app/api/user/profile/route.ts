/**
 * 用户信息接口
 * GET /api/user/profile - 获取当前用户信息
 */

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth-guard';
import { apiSuccess, apiNotFound, apiServerError } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const auth = requireUser(request);
        if (auth instanceof Response) {
            return auth;
        }

        // 查询用户
        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
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
