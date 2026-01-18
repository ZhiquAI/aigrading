/**
 * 激活码验证 API
 * POST - 验证并使用激活码，增加设备配额
 * GET - 查询激活状态和剩余配额
 */

import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

/**
 * POST /api/activation/verify
 * 验证并使用激活码，增加设备配额
 * Body: { code: string, deviceId: string }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, deviceId } = body;

        if (!code) {
            return apiError('请输入激活码');
        }

        if (!deviceId) {
            return apiError('设备标识不能为空');
        }

        // 格式化激活码（去除空格，转大写）
        const normalizedCode = code.trim().toUpperCase();

        // 查找激活码
        const activationCode = await prisma.activationCode.findUnique({
            where: { code: normalizedCode }
        });

        if (!activationCode) {
            return apiError('激活码不存在', 404);
        }

        // 检查是否已被使用
        if (activationCode.usedBy) {
            return apiError('激活码已被使用');
        }

        // 使用激活码
        await prisma.activationCode.update({
            where: { id: activationCode.id },
            data: {
                usedBy: deviceId,
                usedAt: new Date()
            }
        });

        // 增加设备配额
        const deviceQuota = await prisma.deviceQuota.upsert({
            where: { deviceId },
            update: {
                quota: { increment: activationCode.quota }
            },
            create: {
                deviceId,
                quota: 10 + activationCode.quota  // 免费10次 + 购买配额
            }
        });

        return apiSuccess({
            type: activationCode.type,
            addedQuota: activationCode.quota,
            totalQuota: deviceQuota.quota
        }, `激活成功，已增加 ${activationCode.quota} 份配额`);

    } catch (error) {
        console.error('Activation error:', error);
        return apiServerError('激活失败，请稍后重试');
    }
}

/**
 * GET /api/activation/verify
 * 查询激活状态和剩余配额
 * Query: ?deviceId=xxx
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');

        if (!deviceId) {
            return apiError('设备标识不能为空');
        }

        // 查找设备配额
        let deviceQuota = await prisma.deviceQuota.findUnique({
            where: { deviceId }
        });

        // 如果没有记录，创建默认配额
        if (!deviceQuota) {
            deviceQuota = await prisma.deviceQuota.create({
                data: {
                    deviceId,
                    quota: 10  // 免费10次
                }
            });
        }

        // 查找该设备使用过的激活码
        const activationCodes = await prisma.activationCode.findMany({
            where: { usedBy: deviceId },
            orderBy: { usedAt: 'desc' }
        });

        const isPaid = activationCodes.length > 0;

        return apiSuccess({
            isPaid,
            quota: deviceQuota.quota,
            totalUsed: deviceQuota.totalUsed,
            activations: activationCodes.map(c => ({
                type: c.type,
                quota: c.quota,
                activatedAt: c.usedAt?.toISOString()
            }))
        });

    } catch (error) {
        console.error('Check activation error:', error);
        return apiServerError('查询失败');
    }
}
