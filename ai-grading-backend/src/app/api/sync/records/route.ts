/**
 * 批改记录同步 API
 * GET - 分页获取记录
 * POST - 批量上传记录
 */

import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { apiSuccess, apiCreated, apiUnauthorized, apiError, apiServerError } from '@/lib/api-response';

// 获取当前用户 ID
async function getCurrentUserId(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    if (!token) return null;

    const payload = verifyToken(token);
    return payload?.userId || null;
}

/**
 * GET /api/sync/records
 * 分页获取批改记录
 * Query: ?page=1&limit=20&questionNo=Q1
 */
export async function GET(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const questionNo = searchParams.get('questionNo');

        // 构建查询条件
        const where: { userId: string; questionNo?: string } = { userId };
        if (questionNo) {
            where.questionNo = questionNo;
        }

        // 并行查询数据和总数
        const [records, total] = await Promise.all([
            prisma.gradingRecord.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    questionNo: true,
                    studentName: true,
                    examNo: true,
                    score: true,
                    maxScore: true,
                    comment: true,
                    breakdown: true,
                    createdAt: true
                }
            }),
            prisma.gradingRecord.count({ where })
        ]);

        // 解析 breakdown JSON
        const parsedRecords = records.map(record => ({
            ...record,
            breakdown: record.breakdown ? JSON.parse(record.breakdown) : null
        }));

        return apiSuccess({
            records: parsedRecords,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Get records error:', error);
        return apiServerError('获取记录失败');
    }
}

/**
 * POST /api/sync/records
 * 批量上传批改记录
 * Body: { records: [{ studentName, score, maxScore, ... }] }
 */
export async function POST(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const body = await request.json();
        const { records } = body;

        if (!Array.isArray(records) || records.length === 0) {
            return apiError('records 必须是非空数组');
        }

        if (records.length > 100) {
            return apiError('单次最多上传 100 条记录');
        }

        // 批量创建记录
        const createdRecords = await prisma.gradingRecord.createMany({
            data: records.map(record => ({
                userId,
                questionNo: record.questionNo || null,
                studentName: record.studentName || '未知',
                examNo: record.examNo || null,
                score: record.score || 0,
                maxScore: record.maxScore || 0,
                comment: record.comment || null,
                breakdown: record.breakdown ? JSON.stringify(record.breakdown) : null
            }))
        });

        return apiCreated({
            created: createdRecords.count
        }, `成功上传 ${createdRecords.count} 条记录`);
    } catch (error) {
        console.error('Create records error:', error);
        return apiServerError('上传记录失败');
    }
}

/**
 * DELETE /api/sync/records
 * 删除记录
 * Query: ?id=xxx (删除单条) 或 ?questionNo=xxx (删除该题目所有记录)
 */
export async function DELETE(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const questionNo = searchParams.get('questionNo');

        if (id) {
            // 删除单条记录
            await prisma.gradingRecord.deleteMany({
                where: { id, userId }
            });
            return apiSuccess(null, '记录已删除');
        } else if (questionNo) {
            // 删除该题目所有记录
            const result = await prisma.gradingRecord.deleteMany({
                where: { userId, questionNo }
            });
            return apiSuccess({ deleted: result.count }, `已删除 ${result.count} 条记录`);
        } else {
            return apiError('请指定 id 或 questionNo');
        }
    } catch (error) {
        console.error('Delete records error:', error);
        return apiServerError('删除记录失败');
    }
}
