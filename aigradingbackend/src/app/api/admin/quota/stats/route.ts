import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/quota/stats
 * 获取配额与用量统计数据
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        // 计算起始时间
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

        // 并行查询数据
        const [
            usageRecords,
            activationRecords,
            codeStats,
            overallAggregates
        ] = await Promise.all([
            // 每日消耗 (UsageRecord)
            prisma.usageRecord.findMany({
                where: { createdAt: { gte: startDate } },
                select: { createdAt: true }
            }),
            // 每日发放 (ActivationRecord)
            prisma.activationRecord.findMany({
                where: { createdAt: { gte: startDate } },
                select: { createdAt: true, quotaAdded: true }
            }),
            // 按类型分布
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
            // 总体聚合
            prisma.activationCode.aggregate({
                _sum: {
                    quota: true,
                    used: true,
                    remaining: true
                }
            })
        ]);

        // 处理每日统计
        const dailyMap = new Map<string, { consumption: number; issuance: number }>();

        // 初始化日期范围
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            dailyMap.set(dateStr, { consumption: 0, issuance: 0 });
        }

        // 填充消耗
        usageRecords.forEach(r => {
            const dateStr = r.createdAt.toISOString().split('T')[0];
            if (dailyMap.has(dateStr)) {
                dailyMap.get(dateStr)!.consumption += 1;
            }
        });

        // 填充发放
        activationRecords.forEach(r => {
            const dateStr = r.createdAt.toISOString().split('T')[0];
            if (dailyMap.has(dateStr)) {
                dailyMap.get(dateStr)!.issuance += r.quotaAdded;
            }
        });

        const dailyStats = Array.from(dailyMap.entries()).map(([date, data]) => ({
            date,
            ...data
        })).sort((a, b) => a.date.localeCompare(b.date));

        const typeDistribution = codeStats.map(item => ({
            type: item.type,
            count: item._count.id,
            totalQuota: item._sum.quota || 0,
            usedQuota: item._sum.used || 0,
            remainingQuota: item._sum.remaining || 0
        }));

        return NextResponse.json({
            success: true,
            data: {
                dailyStats,
                typeDistribution,
                summary: {
                    totalIssued: overallAggregates._sum.quota || 0,
                    totalUsed: overallAggregates._sum.used || 0,
                    totalRemaining: overallAggregates._sum.remaining || 0,
                    avgDailyConsumption: usageRecords.length / days
                }
            }
        });

    } catch (error) {
        console.error('[Admin Quota Stats] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取配额统计失败'
        }, { status: 500 });
    }
}
