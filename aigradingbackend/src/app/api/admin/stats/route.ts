import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/stats
 * 获取管理后台统计数据
 */
export async function GET(request: NextRequest) {
    try {
        // 验证管理员token
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
        }

        // 并行查询统计数据
        const [
            totalCodes,
            activeCodes,
            totalActivations,
            totalDevices,
            totalUsage,
            quotaAggregates
        ] = await Promise.all([
            prisma.activationCode.count(),
            prisma.activationCode.count({ where: { status: 'active' } }),
            prisma.activationRecord.count(),
            prisma.deviceQuota.count(),
            prisma.usageRecord.count(),
            prisma.deviceQuota.aggregate({
                _sum: {
                    remaining: true,
                    used: true
                }
            })
        ]);

        const stats = {
            totalCodes,
            activeCodes,
            totalActivations,
            totalDevices,
            totalUsage,
            totalQuotaRemaining: quotaAggregates._sum.remaining || 0,
            totalQuotaUsed: quotaAggregates._sum.used || 0
        };

        return NextResponse.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[Admin Stats] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取统计数据失败'
        }, { status: 500 });
    }
}
