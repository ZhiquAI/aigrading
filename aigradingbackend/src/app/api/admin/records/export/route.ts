/**
 * 批改记录导出 CSV API
 * 
 * GET /api/admin/records/export
 * 
 * Query 参数:
 * - startDate: 开始日期 (ISO 格式)
 * - endDate: 结束日期 (ISO 格式)
 * - questionNo: 题号筛选
 * - questionKey: 题目 Key 筛选
 * - activationCode: 激活码筛选
 * 
 * 响应: text/csv 文件下载
 */

import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// CSV 字段定义
const CSV_HEADERS = [
    '序号',
    '学生姓名',
    '准考证号',
    '题号',
    '详细得分',
    '满分',
    '评语',
    '批改时间'
];

// 转义 CSV 字段（处理逗号、引号、换行）
function escapeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    // 如果包含逗号、引号或换行，需要用引号包裹并转义内部引号
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// 格式化日期
function formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // 解析查询参数
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const questionNo = searchParams.get('questionNo');
        const questionKey = searchParams.get('questionKey');
        const activationCode = searchParams.get('activationCode');

        // 构建查询条件
        const where: {
            createdAt?: { gte?: Date; lte?: Date };
            questionNo?: string;
            questionKey?: string;
            activationCode?: string;
        } = {};

        if (startDate) {
            where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
        }
        if (endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        }
        if (questionNo) {
            where.questionNo = questionNo;
        }
        if (questionKey) {
            where.questionKey = questionKey;
        }
        if (activationCode) {
            where.activationCode = activationCode;
        }

        // 查询记录（限制最大 10000 条）
        const records = await prisma.gradingRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10000,
            select: {
                studentName: true,
                examNo: true,
                questionNo: true,
                score: true,
                maxScore: true,
                comment: true,
                createdAt: true
            }
        });

        // 生成 CSV 内容
        const csvLines: string[] = [];

        // 添加 BOM 以支持 Excel 中文显示
        // 添加表头
        csvLines.push(CSV_HEADERS.map(escapeCSV).join(','));

        // 添加数据行
        records.forEach((record, index) => {
            const row = [
                index + 1,
                record.studentName,
                record.examNo || '',
                record.questionNo || '',
                record.score,
                record.maxScore,
                record.comment || '',
                formatDate(record.createdAt)
            ];
            csvLines.push(row.map(escapeCSV).join(','));
        });

        const csvContent = '\uFEFF' + csvLines.join('\r\n');

        // 生成文件名
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `grading_records_${timestamp}.csv`;

        // 返回 CSV 响应
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error('[Export CSV] Error:', error);
        return NextResponse.json(
            { success: false, message: '导出失败' },
            { status: 500 }
        );
    }
}
