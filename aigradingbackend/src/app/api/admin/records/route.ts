import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/records
 * 获取激活记录列表
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');
        const code = searchParams.get('code');
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: any = {};
        if (deviceId) {
            where.deviceId = deviceId;
        }
        if (code) {
            where.code = code;
        }

        const records = await prisma.activationRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        return NextResponse.json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('[Admin Records] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取激活记录失败'
        }, { status: 500 });
    }
}
