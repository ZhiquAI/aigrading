import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/records
 * 获取激活记录列表
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
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
