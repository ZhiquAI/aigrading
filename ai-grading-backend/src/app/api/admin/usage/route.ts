import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');

        // 获取日期范围
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

        // 查询使用记录
        const records = await prisma.usageRecord.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            select: { createdAt: true }
        });

        // 按日期分组统计
        const dateMap = new Map<string, number>();

        // 初始化所有日期
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dateMap.set(d.toISOString().slice(0, 10), 0);
        }

        // 统计每日数量
        records.forEach((r) => {
            const date = r.createdAt.toISOString().slice(0, 10);
            dateMap.set(date, (dateMap.get(date) || 0) + 1);
        });

        const usage = Array.from(dateMap.entries()).map(([date, count]) => ({
            date,
            count
        }));

        return NextResponse.json({
            success: true,
            data: { usage }
        });
    } catch (error) {
        console.error('Usage error:', error);
        return NextResponse.json({
            success: false,
            message: '获取统计失败'
        }, { status: 500 });
    }
}
