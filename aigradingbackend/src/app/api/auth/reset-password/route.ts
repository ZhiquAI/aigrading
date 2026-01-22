/**
 * 重置密码接口
 * POST /api/auth/reset-password
 * 
 * 使用重置令牌设置新密码
 */

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token) {
            return apiError('缺少重置令牌', 400, ErrorCode.INVALID_REQUEST);
        }

        if (!newPassword) {
            return apiError('请提供新密码', 400, ErrorCode.INVALID_REQUEST);
        }

        // 密码强度验证
        if (newPassword.length < 6) {
            return apiError('密码长度至少 6 位', 400, ErrorCode.INVALID_REQUEST);
        }

        // 验证重置令牌
        const payload = verifyPasswordResetToken(token);
        if (!payload) {
            return apiError('重置链接无效或已过期', 400, ErrorCode.AUTH_TOKEN_INVALID);
        }

        // 查找用户
        const user = await prisma.user.findUnique({
            where: { id: payload.userId }
        });

        if (!user) {
            return apiError('用户不存在', 404, ErrorCode.RECORD_NOT_FOUND);
        }

        // 确保邮箱匹配
        if (user.email !== payload.email) {
            return apiError('令牌无效', 400, ErrorCode.AUTH_TOKEN_INVALID);
        }

        // 哈希新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        logger.info('Password reset successful', {
            userId: user.id
        });

        return apiSuccess(null, '密码重置成功，请使用新密码登录');

    } catch (error) {
        console.error('Reset password error:', error);
        return apiError('重置失败，请稍后重试', 500);
    }
}
