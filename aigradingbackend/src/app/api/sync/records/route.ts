/**
 * 批改记录同步 API（基于激活码）
 * 
 * GET - 分页获取记录（按激活码查询）
 * POST - 批量上传记录
 * DELETE - 删除记录
 * 
 * Header: x-activation-code - 激活码（必需）
 * Header: x-device-id - 设备ID（可选，用于追踪来源）
 */

import { prisma } from '@/lib/prisma';
import { apiSuccess, apiCreated, apiError, apiServerError } from '@/lib/api-response';

// 获取激活码（从 header 中）
function getActivationCode(request: Request): string | null {
    return request.headers.get('x-activation-code');
}

// 获取设备ID（可选）
function getDeviceId(request: Request): string | null {
    return request.headers.get('x-device-id');
}

/**
 * GET /api/sync/records
 * 分页获取批改记录（按激活码查询）
 * Query: ?page=1&limit=20&questionNo=Q1&questionKey=xxx
 */
export async function GET(request: Request) {
    try {
        const activationCode = getActivationCode(request);
        if (!activationCode) {
            return apiError('缺少激活码', 401);
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const questionNo = searchParams.get('questionNo');
        const questionKey = searchParams.get('questionKey');

        // 构建查询条件
        const where: {
            activationCode: string;
            questionNo?: string;
            questionKey?: string;
        } = { activationCode };

        if (questionNo) {
            where.questionNo = questionNo;
        }
        if (questionKey) {
            where.questionKey = questionKey;
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
                    questionKey: true,
                    studentName: true,
                    examNo: true,
                    score: true,
                    maxScore: true,
                    comment: true,
                    breakdown: true,
                    createdAt: true,
                    deviceId: true
                }
            }),
            prisma.gradingRecord.count({ where })
        ]);

        // 解析 breakdown JSON
        const parsedRecords = records.map(record => ({
            ...record,
            breakdown: record.breakdown ? JSON.parse(record.breakdown) : null,
            // 转换时间戳格式（前端期望的格式）
            timestamp: record.createdAt.getTime()
        }));

        return apiSuccess({
            records: parsedRecords,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('[Sync Records] GET error:', error);
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
        const activationCode = getActivationCode(request);
        if (!activationCode) {
            return apiError('缺少激活码', 401);
        }

        const deviceId = getDeviceId(request);
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
                activationCode,
                deviceId: record.deviceId || deviceId || null,
                questionNo: record.questionNo || null,
                questionKey: record.questionKey || null,
                studentName: record.studentName || record.name || '未知',
                examNo: record.examNo || null,
                score: Number(record.score) || 0,
                maxScore: Number(record.maxScore) || 0,
                comment: record.comment || null,
                breakdown: record.breakdown
                    ? (typeof record.breakdown === 'string' ? record.breakdown : JSON.stringify(record.breakdown))
                    : null
            }))
        });

        console.log(`[Sync Records] Created ${createdRecords.count} records for ${activationCode}`);

        return apiCreated({
            created: createdRecords.count
        }, `成功上传 ${createdRecords.count} 条记录`);
    } catch (error) {
        console.error('[Sync Records] POST error:', error);
        return apiServerError('上传记录失败');
    }
}

/**
 * DELETE /api/sync/records
 * 删除记录
 * Query: ?id=xxx (删除单条) 或 ?questionNo=xxx / ?questionKey=xxx (删除该题目所有记录)
 */
export async function DELETE(request: Request) {
    try {
        const activationCode = getActivationCode(request);
        if (!activationCode) {
            return apiError('缺少激活码', 401);
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const questionNo = searchParams.get('questionNo');
        const questionKey = searchParams.get('questionKey');

        if (id) {
            // 删除单条记录
            await prisma.gradingRecord.deleteMany({
                where: { id, activationCode }
            });
            return apiSuccess(null, '记录已删除');
        } else if (questionKey) {
            // 删除该题目（questionKey）所有记录
            const result = await prisma.gradingRecord.deleteMany({
                where: { activationCode, questionKey }
            });
            return apiSuccess({ deleted: result.count }, `已删除 ${result.count} 条记录`);
        } else if (questionNo) {
            // 删除该题目（questionNo）所有记录
            const result = await prisma.gradingRecord.deleteMany({
                where: { activationCode, questionNo }
            });
            return apiSuccess({ deleted: result.count }, `已删除 ${result.count} 条记录`);
        } else {
            return apiError('请指定 id、questionNo 或 questionKey');
        }
    } catch (error) {
        console.error('[Sync Records] DELETE error:', error);
        return apiServerError('删除记录失败');
    }
}
