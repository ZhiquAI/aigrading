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

        // 获取今日零点时间
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 并行查询统计数据
        const [
            totalCodes,
            activeCodes,
            totalActivations,
            totalUsage,
            todayUsage,
            latestRecords,
            quotaAggregates,
            quotaStatsByType,
            topActiveCodesRaw
        ] = await Promise.all([
            prisma.activationCode.count(),
            prisma.activationCode.count({ where: { status: 'active' } }),
            prisma.activationRecord.count(),
            prisma.usageRecord.count(),
            prisma.usageRecord.count({
                where: { createdAt: { gte: todayStart } }
            }),
            prisma.gradingRecord.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    studentName: true,
                    score: true,
                    maxScore: true,
                    createdAt: true,
                    activationCode: true
                }
            }),
            prisma.deviceQuota.aggregate({
                _sum: {
                    remaining: true,
                    used: true
                }
            }),
            prisma.activationCode.groupBy({
                by: ['type'],
                _sum: {
                    quota: true,
                    used: true,
                    remaining: true
                },
                _count: {
                    id: true
                }
            }),
            prisma.activationCode.findMany({
                where: { used: { gt: 0 } },
                take: 10,
                orderBy: { used: 'desc' },
                select: {
                    code: true,
                    type: true,
                    used: true,
                    remaining: true,
                    quota: true
                }
            })
        ]);

        const stats = {
            totalCodes,
            activeCodes,
            totalActivations,
            totalUsage,
            todayUsage,
            latestRecords,
            quotaStatsByType: quotaStatsByType.map(item => ({
                type: item.type,
                count: item._count.id,
                totalQuota: item._sum.quota || 0,
                usedQuota: item._sum.used || 0,
                remainingQuota: item._sum.remaining || 0,
                usageRate: item._sum.quota ? Math.round((item._sum.used || 0) / item._sum.quota * 100) : 0
            })),
            topActiveCodes: topActiveCodesRaw,
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
