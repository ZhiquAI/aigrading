import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/quota/by-code
 * 获取按激活码统计的数据（表格视图）
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') || 'used';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const filterType = searchParams.get('filterType');
        const searchCode = searchParams.get('search');

        const skip = (page - 1) * limit;

        // 构建查询条件
        const where: any = {};

        if (filterType && filterType !== 'all') {
            where.type = filterType;
        }

        if (searchCode) {
            where.code = {
                contains: searchCode,
                mode: 'insensitive'
            };
        }

        // 并行查询统计数据和总数
        const [codes, totalCount, gradingCounts, rubricCounts] = await Promise.all([
            prisma.activationCode.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc'
                },
                select: {
                    id: true,
                    code: true,
                    type: true,
                    quota: true,
                    remaining: true,
                    used: true,
                    status: true,
                    reusable: true,
                    maxDevices: true,
                    usedBy: true,
                    usedAt: true,
                    expiresAt: true,
                    createdAt: true,
                    batchId: true,
                }
            }),
            prisma.activationCode.count({ where }),
            // 获取每个激活码的批改记录数
            prisma.gradingRecord.groupBy({
                by: ['activationCode'],
                _count: {
                    id: true
                }
            }),
            // 获取每个激活码的评分细则数
            prisma.deviceRubric.groupBy({
                by: ['activationCode'],
                _count: {
                    id: true
                }
            })
        ]);

        // 构建统计数据映射
        const gradingCountMap = new Map(
            gradingCounts.map(g => [g.activationCode, g._count.id])
        );
        const rubricCountMap = new Map(
            rubricCounts.map(r => [r.activationCode, r._count.id])
        );

        // 组合数据
        const data = codes.map(code => ({
            ...code,
            gradingCount: gradingCountMap.get(code.code) || 0,
            rubricCount: rubricCountMap.get(code.code) || 0,
            usageRate: code.quota > 0 ? ((code.used / code.quota) * 100).toFixed(1) : '0'
        }));

        return NextResponse.json({
            success: true,
            data: {
                list: data,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            }
        });
    } catch (error) {
        console.error('[Admin Quota By Code] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取统计数据失败'
        }, { status: 500 });
    }
}
