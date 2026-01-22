/**
 * 忘记密码接口
 * POST /api/auth/forgot-password
 * 
 * 发送密码重置邮件（当前版本仅生成重置令牌，邮件发送需要配置）
 */

import { prisma } from '@/lib/prisma';
import { signPasswordResetToken } from '@/lib/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return apiError('请提供邮箱地址', 400, ErrorCode.INVALID_REQUEST);
        }

        // 查找用户
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // 无论用户是否存在，都返回成功（防止用户枚举攻击）
        if (!user) {
            logger.info('Password reset requested for non-existent email', { email: email.substring(0, 3) + '***' });
            return apiSuccess(null, '如果该邮箱已注册，您将收到重置链接');
        }

        // 生成重置令牌
        const resetToken = signPasswordResetToken(user.id, user.email);

        // TODO: 发送邮件
        // 当前版本仅记录日志，实际生产需要集成邮件服务（如 SendGrid, Alibaba Cloud Email）
        logger.info('Password reset token generated', {
            userId: user.id,
            email: email.substring(0, 3) + '***'
        });

        // 在开发环境下返回 token（仅用于测试）
        if (process.env.NODE_ENV === 'development') {
            return apiSuccess({
                resetToken,
                message: '开发模式：直接返回重置令牌',
                resetUrl: `/reset-password?token=${resetToken}`
            }, '重置令牌已生成');
        }

        return apiSuccess(null, '如果该邮箱已注册，您将收到重置链接');

    } catch (error) {
        console.error('Forgot password error:', error);
        return apiError('请求失败，请稍后重试', 500);
    }
}
