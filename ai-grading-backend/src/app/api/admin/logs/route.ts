import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/logs
 * 获取使用日志
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');
        const limit = parseInt(searchParams.get('limit') || '100');

        const where: any = {};
        if (deviceId && deviceId !== 'all') {
            where.deviceId = deviceId;
        }

        const logs = await prisma.usageRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        return NextResponse.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('[Admin Logs] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取使用日志失败'
        }, { status: 500 });
    }
}
