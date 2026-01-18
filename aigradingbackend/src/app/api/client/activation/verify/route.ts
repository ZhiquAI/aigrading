import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/client/activation/verify
 * 验证激活码并为设备添加额度
 */
export async function POST(request: NextRequest) {
    try {
        const deviceId = request.headers.get('X-Device-ID');
        if (!deviceId) {
            return NextResponse.json({
                success: false,
                message: '缺少设备标识'
            }, { status: 400 });
        }

        const body = await request.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json({
                success: false,
                message: '激活码不能为空'
            }, { status: 400 });
        }

        // 查找激活码
        const activationCode = await prisma.activationCode.findUnique({
            where: { code }
        });

        if (!activationCode) {
            return NextResponse.json({
                success: false,
                message: '激活码不存在'
            }, { status: 404 });
        }

        // 检查激活码状态
        if (activationCode.status !== 'active') {
            return NextResponse.json({
                success: false,
                message: '激活码已被禁用'
            }, { status: 400 });
        }

        // 检查过期时间
        if (activationCode.expiresAt && new Date(activationCode.expiresAt) < new Date()) {
            return NextResponse.json({
                success: false,
                message: '激活码已过期'
            }, { status: 400 });
        }

        // 试用码逻辑：全局一次性
        if (!activationCode.reusable) {
            if (activationCode.usedBy) {
                return NextResponse.json({
                    success: false,
                    message: '试用码已被使用'
                }, { status: 400 });
            }

            // 标记为已使用
            await prisma.activationCode.update({
                where: { code },
                data: {
                    usedBy: deviceId,
                    usedAt: new Date()
                }
            });
        }

        // 获取或创建设备额度
        let deviceQuota = await prisma.deviceQuota.findUnique({
            where: { deviceId }
        });

        if (!deviceQuota) {
            // 创建新设备
            deviceQuota = await prisma.deviceQuota.create({
                data: {
                    deviceId,
                    remaining: activationCode.quota,
                    total: activationCode.quota,
                    used: 0
                }
            });
        } else {
            // 更新现有设备
            deviceQuota = await prisma.deviceQuota.update({
                where: { deviceId },
                data: {
                    remaining: deviceQuota.remaining + activationCode.quota,
                    total: deviceQuota.total + activationCode.quota
                }
            });
        }

        // 记录激活行为
        await prisma.activationRecord.create({
            data: {
                code,
                deviceId,
                quotaAdded: activationCode.quota
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                quotaAdded: activationCode.quota,
                remaining: deviceQuota.remaining,
                total: deviceQuota.total,
                codeType: activationCode.type
            }
        });
    } catch (error) {
        console.error('[Client Activation] Error:', error);
        return NextResponse.json({
            success: false,
            message: '激活失败，请稍后重试'
        }, { status: 500 });
    }
}
