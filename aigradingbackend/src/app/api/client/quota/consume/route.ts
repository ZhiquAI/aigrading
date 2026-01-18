import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/client/quota/consume
 * 消费额度
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
        const { amount = 1, metadata } = body;

        // 查询设备额度
        const deviceQuota = await prisma.deviceQuota.findUnique({
            where: { deviceId }
        });

        if (!deviceQuota) {
            return NextResponse.json({
                success: false,
                message: '设备未激活',
                code: 'QUOTA_INSUFFICIENT'
            }, { status: 403 });
        }

        // 检查额度是否充足
        if (deviceQuota.remaining < amount) {
            return NextResponse.json({
                success: false,
                message: '额度不足',
                code: 'QUOTA_INSUFFICIENT'
            }, { status: 403 });
        }

        // 扣减额度
        const updated = await prisma.deviceQuota.update({
            where: { deviceId },
            data: {
                remaining: deviceQuota.remaining - amount,
                used: deviceQuota.used + amount
            }
        });

        // 记录使用日志
        await prisma.usageRecord.create({
            data: {
                deviceId,
                metadata: metadata ? JSON.stringify(metadata) : null
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                remaining: updated.remaining,
                consumed: amount
            }
        });
    } catch (error) {
        console.error('[Client Quota Consume] Error:', error);
        return NextResponse.json({
            success: false,
            message: '消费额度失败'
        }, { status: 500 });
    }
}
