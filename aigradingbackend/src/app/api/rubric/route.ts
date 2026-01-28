/**
 * 评分细则存储 API v3（基于激活码/设备ID）
 *
 * GET /api/rubric - 获取评分细则列表或单个
 * POST /api/rubric - 保存评分细则（支持冲突检测）
 * DELETE /api/rubric - 删除评分细则
 *
 * Header: x-activation-code - 激活码（可选，用于跨设备同步）
 * Header: x-device-id - 设备ID（可选，用于匿名用户云端存储）
 *
 * 设备标识降级机制：
 * - 优先使用激活码作为标识符（支持跨设备同步）
 * - 如果没有激活码，使用 device:${deviceId} 作为标识符（支持匿名用户）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RubricJSON, RubricListItem, validateRubricJSON, rubricToListItem } from '@/lib/rubric-types';

/**
 * 获取激活码（可选）
 */
function getActivationCode(request: NextRequest): string | null {
    return request.headers.get('x-activation-code');
}

/**
 * 获取设备ID（可选）
 */
function getDeviceId(request: NextRequest): string | null {
    return request.headers.get('x-device-id');
}

/**
 * 获取用户标识符（设备标识降级机制）
 * 优先使用激活码，如果没有则使用 device:${deviceId}
 * 如果都没有，生成匿名标识符（支持试用模式）
 */
function getUserIdentifier(request: NextRequest): string {
    const activationCode = getActivationCode(request);
    const deviceId = getDeviceId(request);

    // 优先使用激活码（支持跨设备同步）
    if (activationCode) {
        return activationCode;
    }

    // 降级到设备ID（支持匿名用户云端存储）
    if (deviceId) {
        return `device:${deviceId}`;
    }

    // 都没有时生成匿名标识符（试用模式）
    const anonymousId = `anonymous:${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return anonymousId;
}

/**
 * 格式化标识符用于日志（脱敏）
 */
function formatIdentifierForLog(identifier: string): string {
    if (identifier.startsWith('device:')) {
        return `device:${identifier.substring(7, 14)}...`;
    }
    return `${identifier.substring(0, 10)}...`;
}

/**
 * GET /api/rubric
 * 获取评分细则
 * Header: x-activation-code (可选，用于跨设备同步)
 * Header: x-device-id (可选，用于匿名用户)
 * Query: questionKey (可选)
 * Query: examId (可选)
 *
 * 不带 questionKey: 返回列表
 * 带 questionKey: 返回单个完整数据
 */
export async function GET(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const url = new URL(request.url);
        const questionKey = url.searchParams.get('questionKey');
        const examId = url.searchParams.get('examId');

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

        console.log(`[Rubric API] GET - Found ${records.length} rubrics for ${formatIdentifierForLog(identifier)}`);

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
 * Header: x-activation-code (可选，用于跨设备同步)
 * Header: x-device-id (可选，用于匿名用户)
 *
 * 冲突处理：
 * - 如果服务器有更新版本，返回 409 + 双方数据
 */
export async function POST(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const deviceId = getDeviceId(request);

        const body = await request.json();

        // --- 修复点：支持包装后的 body (兼容 proxyService) ---
        // 期望：{ questionKey?: string, rubric: RubricJSON | string, examId?: string }
        // 或者：RubricJSON

        let rawRubric = body.rubric || body;
        if (typeof rawRubric === 'string') {
            try {
                rawRubric = JSON.parse(rawRubric);
            } catch (e) {
                return NextResponse.json({
                    success: false,
                    error: '无效的 JSON 字符串',
                    code: 'INVALID_JSON'
                }, { status: 400 });
            }
        }

        // 验证格式
        const validation = validateRubricJSON(rawRubric);
        if (!validation.valid) {
            console.warn('[Rubric API] Validation failed:', validation.errors);
            return NextResponse.json({
                success: false,
                error: `格式错误: ${validation.errors.join(', ')}`,
                code: 'INVALID_REQUEST'
            }, { status: 400 });
        }

        const rubric = validation.rubric!;

        // --- 修复点：优先使用外部传入的 questionKey ---
        // 如果是手动创建的题目，前端会传 `manual:15`，必须保留这个前缀
        const questionKey = body.questionKey || rubric.questionId;
        const examId = body.examId || (rawRubric as any).examId || null;

        // 检查冲突
        const existing = await prisma.deviceRubric.findUnique({
            where: {
                activationCode_questionKey: { activationCode: identifier, questionKey }
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
                activationCode_questionKey: { activationCode: identifier, questionKey }
            },
            update: {
                rubric: JSON.stringify(rubricToSave),
                deviceId: deviceId || undefined,
                examId: examId || undefined
            },
            create: {
                activationCode: identifier,
                deviceId: deviceId || null,
                questionKey,
                rubric: JSON.stringify(rubricToSave),
                examId: examId || null
            }
        });

        console.log(`[Rubric API] Saved: ${questionKey} (Exam: ${examId}) for ${formatIdentifierForLog(identifier)}`);

        return NextResponse.json({
            success: true,
            rubric: rubricToSave,
            examId
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
 * Header: x-activation-code (可选，用于跨设备同步)
 * Header: x-device-id (可选，用于匿名用户)
 */
export async function DELETE(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const questionKey = new URL(request.url).searchParams.get('questionKey');

        if (!questionKey) {
            return NextResponse.json({
                success: false,
                error: '缺少必填参数（需要questionKey）',
                code: 'INVALID_REQUEST'
            }, { status: 400 });
        }

        try {
            await prisma.deviceRubric.delete({
                where: {
                    activationCode_questionKey: { activationCode: identifier, questionKey }
                }
            });

            console.log(`[Rubric API] Deleted: ${questionKey} (${formatIdentifierForLog(identifier)})`);

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
