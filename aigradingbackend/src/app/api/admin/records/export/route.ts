import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/records/export
 * 导出批改记录为 CSV
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const studentName = searchParams.get('studentName') || undefined;
        const activationCode = searchParams.get('activationCode') || undefined;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;

        // 构建查询条件
        const whereClause: any = {};
        if (studentName) whereClause.studentName = { contains: studentName };
        if (activationCode) whereClause.activationCode = { equals: activationCode };
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt.gte = new Date(startDate);
            if (endDate) whereClause.createdAt.lte = new Date(endDate);
        }

        // 获取数据
        const records = await prisma.gradingRecord.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            select: {
                createdAt: true,
                studentName: true,
                questionNo: true,
                score: true,
                maxScore: true,
                activationCode: true,
                comment: true
            }
        });

        // 生成 CSV 内容
        // 使用 UTF-8 BOM 以兼容 Excel 中文显示
        const BOM = '\uFEFF';
        const header = ['日期', '学生姓名', '题号', '得分', '总分', '激活码', '评语'].join(',');
        const rows = records.map(r => {
            const date = new Date(r.createdAt).toLocaleString();
            // 处理 CSV 中的逗号和引号
            const escape = (text: string | null) => {
                if (!text) return '""';
                return `"${String(text).replace(/"/g, '""')}"`;
            };
            return [
                escape(date),
                escape(r.studentName),
                escape(r.questionNo),
                r.score,
                r.maxScore,
                escape(r.activationCode),
                escape(r.comment)
            ].join(',');
        });

        const csvContent = BOM + header + '\n' + rows.join('\n');

        // 返回文件流
        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=grading_records_${new Date().toISOString().split('T')[0]}.csv`
            }
        });

    } catch (error) {
        console.error('[Admin Records Export] Error:', error);
        return new Response('导出失败', { status: 500 });
    }
}
