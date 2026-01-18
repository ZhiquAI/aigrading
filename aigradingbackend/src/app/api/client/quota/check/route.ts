import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/client/quota/check?deviceId=xxx
 * 查询设备的额度信息
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');

        if (!deviceId) {
            return NextResponse.json({
                success: false,
                message: '缺少设备标识'
            }, { status: 400 });
        }

        // 查询设备额度
        const deviceQuota = await prisma.deviceQuota.findUnique({
            where: { deviceId }
        });

        if (!deviceQuota) {
            // 未激活的设备，返回0额度
            return NextResponse.json({
                success: true,
                data: {
                    remaining: 0,
                    total: 0,
                    used: 0
                }
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                remaining: deviceQuota.remaining,
                total: deviceQuota.total,
                used: deviceQuota.used
            }
        });
    } catch (error) {
        console.error('[Client Quota Check] Error:', error);
        return NextResponse.json({
            success: false,
            message: '查询额度失败'
        }, { status: 500 });
    }
}
