import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/devices
 * 获取设备列表及额度信息
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const where: any = {};
        if (search) {
            where.deviceId = { contains: search };
        }

        const devices = await prisma.deviceQuota.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('[Admin Devices] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取设备列表失败'
        }, { status: 500 });
    }
}
