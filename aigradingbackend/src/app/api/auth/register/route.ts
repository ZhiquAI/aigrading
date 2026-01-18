/**
 * 用户注册接口
 * POST /api/auth/register
 */

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { apiCreated, apiError, apiServerError } from '@/lib/api-response';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, name } = body;

        // 验证必填字段
        if (!email || !password) {
            return apiError('邮箱和密码为必填项');
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return apiError('邮箱格式不正确');
        }

        // 验证密码长度
        if (password.length < 6) {
            return apiError('密码长度至少 6 位');
        }

        // 检查邮箱是否已存在
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return apiError('该邮箱已被注册');
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
        });

        // 生成 Token
        const token = signToken({
            userId: user.id,
            email: user.email,
        });

        return apiCreated(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                },
                token,
            },
            '注册成功'
        );
    } catch (error) {
        console.error('Register error:', error);
        return apiServerError('注册失败，请稍后重试');
    }
}
