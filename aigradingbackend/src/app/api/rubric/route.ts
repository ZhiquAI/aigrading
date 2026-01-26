/**
 * 评分细则存储 API v3（基于激活码）
 * 
 * GET /api/rubric - 获取评分细则列表或单个
 * POST /api/rubric - 保存评分细则（支持冲突检测）
 * DELETE /api/rubric - 删除评分细则
 * 
 * Header: x-activation-code - 激活码（必需，跨设备同步的核心标识）
 * Header: x-device-id - 设备ID（可选，追踪来源）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RubricJSON, RubricListItem, validateRubricJSON, rubricToListItem } from '@/lib/rubric-types';

// 获取激活码
function getActivationCode(request: NextRequest): string | null {
    return request.headers.get('x-activation-code');
}

// 获取设备ID（可选）
function getDeviceId(request: NextRequest): string | null {
    return request.headers.get('x-device-id');
}

/**
 * GET /api/rubric
 * 获取评分细则
 * Header: x-activation-code (优先) 或 Query: deviceId (回退)
 * Query: questionKey (可选)
 * 
 * 不带 questionKey: 返回列表
 * 带 questionKey: 返回单个完整数据
 */
export async function GET(request: NextRequest) {
    try {
        const activationCode = getActivationCode(request);
        const url = new URL(request.url);
        const questionKey = url.searchParams.get('questionKey');
        const deviceId = url.searchParams.get('deviceId') || getDeviceId(request);
        const examId = url.searchParams.get('examId');

        // 优先使用激活码，否则使用设备ID作为临时标识
        const identifier = activationCode || (deviceId ? `device:${deviceId}` : null);

        if (!identifier) {
            return NextResponse.json({
                success: true,
                rubrics: [],
                message: '未提供激活码或设备ID'
            });
        }

        // 单个查询
        if (questionKey) {
            const record = await prisma.deviceRubric.findUnique({
                where: {
                    activationCode_questionKey: { activationCode: identifier, questionKey }
                }
            });

            if (!record) {
                return NextResponse.json({
                    success: true,
                    rubric: null,
                    message: '评分细则不存在'
                });
            }

            // 解析 JSON
            try {
                const rubric = JSON.parse(record.rubric) as RubricJSON;
                return NextResponse.json({
                    success: true,
                    rubric
                });
            } catch {
                // 旧格式（字符串），返回兼容格式
                return NextResponse.json({
                    success: true,
                    rubric: null,
                    legacyContent: record.rubric,
                    message: '旧格式数据，请重新生成'
                });
            }
        }

        // 列表查询
        const records = await prisma.deviceRubric.findMany({
            where: {
                activationCode: identifier,
                ...(examId ? { examId } : {})
            },
            orderBy: { updatedAt: 'desc' }
        });

        const rubrics: RubricListItem[] = [];

        for (const record of records) {
            try {
                const rubric = JSON.parse(record.rubric) as RubricJSON;
                const listItem = rubricToListItem(rubric);
                // 附加数据库中的 examId
                if (record.examId) {
                    (listItem as any).examId = record.examId;
                }
                rubrics.push(listItem);
            } catch {
                // 跳过无法解析的旧格式
                console.log(`[Rubric API] Skipping legacy format: ${record.questionKey}`);
            }
        }

        return NextResponse.json({
            success: true,
            rubrics
        });

    } catch (error) {
        console.error('[Rubric API] GET error:', error);
        return NextResponse.json({
            success: false,
            error: '获取评分细则失败',
            code: 'INTERNAL_ERROR'
        }, { status: 500 });
    }
}

/**
 * POST /api/rubric
 * 保存或更新评分细则
 * 
 * Body: RubricJSON
 * Header: x-activation-code (必填)
 * Header: x-device-id (可选)
 * 
 * 冲突处理：
 * - 如果服务器有更新版本，返回 409 + 双方数据
 */
export async function POST(request: NextRequest) {
    try {
        const activationCode = getActivationCode(request);
        const deviceId = getDeviceId(request);

        if (!activationCode) {
            return NextResponse.json({
                success: false,
                error: '缺少激活码',
                code: 'INVALID_REQUEST'
            }, { status: 400 });
        }

        const body = await request.json();

        // 验证格式
        const validation = validateRubricJSON(body);
        if (!validation.valid) {
            return NextResponse.json({
                success: false,
                error: `格式错误: ${validation.errors.join(', ')}`,
                code: 'INVALID_REQUEST'
            }, { status: 400 });
        }

        const rubric = validation.rubric!;
        const questionKey = rubric.questionId;

        // 检查冲突
        const existing = await prisma.deviceRubric.findUnique({
            where: {
                activationCode_questionKey: { activationCode, questionKey }
            }
        });

        if (existing) {
            try {
                const serverRubric = JSON.parse(existing.rubric) as RubricJSON;
                const serverTime = new Date(serverRubric.updatedAt).getTime();
                const clientTime = new Date(rubric.updatedAt).getTime();

                // 服务器版本更新，返回冲突
                if (serverTime > clientTime) {
                    return NextResponse.json({
                        success: false,
                        error: 'conflict',
                        code: 'CONFLICT',
                        serverRubric,
                        clientRubric: rubric
                    }, { status: 409 });
                }
            } catch {
                // 服务器是旧格式，直接覆盖
            }
        }

        // 更新时间戳
        const now = new Date().toISOString();
        const rubricToSave: RubricJSON = {
            ...rubric,
            updatedAt: now,
            createdAt: rubric.createdAt || now,
        };

        // 保存
        await prisma.deviceRubric.upsert({
            where: {
                activationCode_questionKey: { activationCode, questionKey }
            },
            update: {
                rubric: JSON.stringify(rubricToSave),
                deviceId: deviceId || undefined,
                examId: body.examId || undefined // 从 Body 中获取考试关联
            },
            create: {
                activationCode,
                deviceId: deviceId || null,
                questionKey,
                rubric: JSON.stringify(rubricToSave),
                examId: body.examId || null
            }
        });

        console.log(`[Rubric API] Saved: ${questionKey} (code: ${activationCode.substring(0, 10)}...)`);

        return NextResponse.json({
            success: true,
            rubric: rubricToSave
        });

    } catch (error) {
        console.error('[Rubric API] POST error:', error);
        return NextResponse.json({
            success: false,
            error: '保存评分细则失败',
            code: 'INTERNAL_ERROR'
        }, { status: 500 });
    }
}

/**
 * DELETE /api/rubric
 * 删除评分细则
 * Query: questionKey (必填)
 * Header: x-activation-code (必填)
 */
export async function DELETE(request: NextRequest) {
    try {
        const activationCode = getActivationCode(request);
        const questionKey = new URL(request.url).searchParams.get('questionKey');

        if (!activationCode || !questionKey) {
            return NextResponse.json({
                success: false,
                error: '缺少必填参数',
                code: 'INVALID_REQUEST'
            }, { status: 400 });
        }

        try {
            await prisma.deviceRubric.delete({
                where: {
                    activationCode_questionKey: { activationCode, questionKey }
                }
            });

            console.log(`[Rubric API] Deleted: ${questionKey}`);

            return NextResponse.json({ success: true });
        } catch (e: unknown) {
            const prismaError = e as { code?: string };
            if (prismaError.code === 'P2025') {
                return NextResponse.json({
                    success: false,
                    error: '评分细则不存在',
                    code: 'NOT_FOUND'
                }, { status: 404 });
            }
            throw e;
        }

    } catch (error) {
        console.error('[Rubric API] DELETE error:', error);
        return NextResponse.json({
            success: false,
            error: '删除评分细则失败',
            code: 'INTERNAL_ERROR'
        }, { status: 500 });
    }
}
