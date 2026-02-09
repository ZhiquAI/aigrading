/**
 * 用户登录接口
 * POST /api/auth/login
 */

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signTokenPair } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // 验证必填字段
        if (!email || !password) {
            return apiError('邮箱和密码为必填项');
        }

        // 查找用户
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return apiError('邮箱或密码错误', 401);
        }

        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return apiError('邮箱或密码错误', 401);
        }

        // 生成 Token 对
        const tokens = signTokenPair({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        // 持久化 refresh token
        await storeRefreshToken(user.id, tokens.refreshToken);

        return apiSuccess(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
            },
            '登录成功'
        );
    } catch (error) {
        console.error('Login error:', error);
        return apiServerError('登录失败，请稍后重试');
    }
}
