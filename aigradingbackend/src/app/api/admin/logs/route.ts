import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/logs
 * 获取使用日志
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
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
