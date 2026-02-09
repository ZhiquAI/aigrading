import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/devices
 * 获取设备列表及额度信息
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
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
