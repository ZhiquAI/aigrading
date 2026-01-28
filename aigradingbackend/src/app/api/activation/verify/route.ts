/**
 * 激活码验证 API
 * POST - 验证并使用激活码，增加设备配额
 * GET - 查询激活状态和剩余配额
 */

import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

/**
 * POST /api/activation/verify
 * 验证并启用激活码，支持多设备共享配额
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, deviceId } = body;

        if (!code || !deviceId) {
            return apiError('请输入激活码和设备标识');
        }

        const normalizedCode = code.trim().toUpperCase();

        // 1. 查找激活码
        const activationCode = await prisma.activationCode.findUnique({
            where: { code: normalizedCode }
        });

        if (!activationCode) {
            return apiError('激活码不存在', 404);
        }

        if (activationCode.status !== 'active') {
            return apiError('激活码已被禁用');
        }

        // 2. 检查设备绑定情况
        const activeDevices = await prisma.activationRecord.findMany({
            where: { code: normalizedCode }
        });

        const isAlreadyUsedByThisDevice = activeDevices.some(r => r.deviceId === deviceId);

        if (!isAlreadyUsedByThisDevice && activeDevices.length >= activationCode.maxDevices) {
            return apiError(`该激活码已达到最大设备绑定数 (${activationCode.maxDevices})`);
        }

        // [New] Strict Trial Limit: Check if this device has EVER used a trial code before
        if (activationCode.type === 'trial') {
            // Check based on code pattern since we don't have a direct relation in schema yet
            const priorTrialByPattern = await prisma.activationRecord.findFirst({
                where: {
                    deviceId: deviceId,
                    code: { startsWith: 'ZY-TRIAL-' }
                }
            });

            if (priorTrialByPattern) {
                // Allow re-activating the SAME trial code (e.g. re-install), but not a new one
                if (priorTrialByPattern.code !== normalizedCode) {
                    return apiError('每台设备仅限试用一次，请购买专业版解锁更多额度', 403);
                }
            }
        }

        // 3. 执行激活逻辑
        // 如果是首次激活（没有任何设备激活过），则初始化剩余配额
        const isFirstActivation = activeDevices.length === 0;

        await prisma.$transaction(async (tx) => {
            // 更新激活码主表
            if (isFirstActivation) {
                await tx.activationCode.update({
                    where: { id: activationCode.id },
                    data: {
                        remaining: activationCode.quota, // 初始化全局余额
                        usedBy: deviceId, // 记录主设备
                        usedAt: new Date()
                    }
                });
            } else if (!isAlreadyUsedByThisDevice) {
                // 如果是新设备加入，仅记录关联
                await tx.activationRecord.create({
                    data: {
                        code: normalizedCode,
                        deviceId: deviceId,
                        quotaAdded: 0 // 后续设备激活不重复加额度，仅共享
                    }
                });
            } else {
                // 已激活设备重复调用，无需操作
            }

            // 首次激活时也需要为首台设备创建 ActivationRecord
            if (isFirstActivation) {
                await tx.activationRecord.create({
                    data: {
                        code: normalizedCode,
                        deviceId: deviceId,
                        quotaAdded: activationCode.quota
                    }
                });
            }
        });

        // 重新获取最新数据
        const updatedCode = await prisma.activationCode.findUnique({
            where: { code: normalizedCode }
        });

        return apiSuccess({
            type: activationCode.type,
            remainingQuota: updatedCode?.remaining || 0,
            totalQuota: activationCode.quota,
            isFirstActivation
        }, `激活成功，当前共享余额：${updatedCode?.remaining} 份`);

    } catch (error) {
        console.error('Activation error:', error);
        return apiServerError('激活失败，请稍后重试');
    }
}

/**
 * GET /api/activation/verify
 * 查询激活状态（包括共享配额）
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');
        const code = searchParams.get('code'); // 如果提供了代码，查特定代码

        if (!deviceId) return apiError('设备标识不能为空');

        // 查找该设备关联的最新激活码
        const latestRecord = await prisma.activationRecord.findFirst({
            where: { deviceId },
            orderBy: { createdAt: 'desc' }
        });

        const activeCode = code || latestRecord?.code;

        if (!activeCode) {
            // 如果没有任何激活码，返回设备免费额度
            const deviceQuota = await prisma.deviceQuota.findUnique({
                where: { deviceId }
            });
            return apiSuccess({
                isPaid: false,
                quota: deviceQuota?.remaining || 10,
                totalUsed: deviceQuota?.used || 0
            });
        }

        // 查找正在使用的共享激活码
        const activationCode = await prisma.activationCode.findUnique({
            where: { code: activeCode }
        });

        if (!activationCode) {
            return apiError('激活码状态异常');
        }

        return apiSuccess({
            isPaid: activationCode.type !== 'trial',
            code: activationCode.code,
            type: activationCode.type,
            quota: activationCode.remaining, // 返回的是该代码的全局余额
            maxQuota: activationCode.quota,
            used: activationCode.used,
            expiresAt: activationCode.expiresAt?.toISOString()
        });

    } catch (error) {
        console.error('Check activation error:', error);
        return apiServerError('查询失败');
    }
}
