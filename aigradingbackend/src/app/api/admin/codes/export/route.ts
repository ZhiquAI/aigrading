import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/codes/export
 * 导出激活码为 CSV
 */
export async function GET(request: NextRequest) {
    try {
        // 验证管理员token
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return new Response('未授权', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || undefined;
        const status = searchParams.get('status') || undefined;
        const batchId = searchParams.get('batchId') || undefined;

        // 构建查询条件
        const whereClause: any = {};
        if (type) whereClause.type = type;
        if (status) whereClause.status = status;
        if (batchId) whereClause.batchId = batchId;

        // 获取数据
        const codes = await prisma.activationCode.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        // 生成 CSV 内容
        const BOM = '\uFEFF';
        const header = ['激活码', '类型', '总配额', '剩余配额', '已使用', '状态', '创建日期'].join(',');
        const rows = codes.map(c => {
            const date = new Date(c.createdAt).toLocaleDateString();
            const escape = (text: string | null) => {
                if (!text) return '""';
                return `"${String(text).replace(/"/g, '""')}"`;
            };
            return [
                escape(c.code),
                escape(c.type),
                c.quota,
                c.remaining,
                c.used,
                escape(c.status),
                escape(date)
            ].join(',');
        });

        const csvContent = BOM + header + '\n' + rows.join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=activation_codes_${new Date().toISOString().split('T')[0]}.csv`
            }
        });

    } catch (error) {
        console.error('[Admin Codes Export] Error:', error);
        return new Response('导出失败', { status: 500 });
    }
}
