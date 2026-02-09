/**
 * 评分细则存储 API（仅支持 Rubric v3）
 *
 * GET /api/rubric - 获取评分细则列表或单个
 * POST /api/rubric - 保存评分细则（支持冲突检测）
 * DELETE /api/rubric - 删除评分细则
 */

import { NextRequest, NextResponse } from 'next/server';
import { ErrorCode } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { RubricSchemaError, parseRubricV3 } from '@/lib/rubric-convert';
import { RubricJSONV3 } from '@/lib/rubric-v3';
import { getRubricPointCount, getRubricTotalScore, RubricListItem, validateRubricJSON } from '@/lib/rubric-types';

type RubricLifecycleStatus = 'draft' | 'published';

function normalizeLifecycleStatus(value: unknown): RubricLifecycleStatus {
    return value === 'published' ? 'published' : 'draft';
}

function getActivationCode(request: NextRequest): string | null {
    return request.headers.get('x-activation-code');
}

function getDeviceId(request: NextRequest): string | null {
    return request.headers.get('x-device-id');
}

function getUserIdentifier(request: NextRequest): string {
    const activationCode = getActivationCode(request);
    const deviceId = getDeviceId(request);

    if (activationCode) return activationCode;
    if (deviceId) return `device:${deviceId}`;
    return `anonymous:${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatIdentifierForLog(identifier: string): string {
    if (identifier.startsWith('device:')) return `device:${identifier.substring(7, 14)}...`;
    return `${identifier.substring(0, 10)}...`;
}

function parseStoredRubric(raw: string): RubricJSONV3 {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new RubricSchemaError(['评分细则存储内容不是合法 JSON']);
    }
    return parseRubricV3(parsed);
}

function rubricSchemaErrorResponse(message: string, details: string[], status: number) {
    return NextResponse.json({
        success: false,
        error: message,
        code: 'RUBRIC_SCHEMA_INVALID',
        errorCode: ErrorCode.RUBRIC_FORMAT_INVALID,
        details
    }, { status });
}

export async function GET(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const url = new URL(request.url);
        const questionKey = url.searchParams.get('questionKey');
        const examId = url.searchParams.get('examId');

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

            try {
                const rubric = parseStoredRubric(record.rubric);
                return NextResponse.json({
                    success: true,
                    rubric,
                    lifecycleStatus: normalizeLifecycleStatus(record.lifecycleStatus)
                });
            } catch (error) {
                if (error instanceof RubricSchemaError) {
                    return rubricSchemaErrorResponse('检测到非 V3 评分细则，请先完成迁移', error.errors, 422);
                }
                throw error;
            }
        }

        const records = await prisma.deviceRubric.findMany({
            where: {
                activationCode: identifier,
                ...(examId ? { examId } : {})
            },
            orderBy: { updatedAt: 'desc' }
        });

        console.log(`[Rubric API] GET - Found ${records.length} rubrics for ${formatIdentifierForLog(identifier)}`);

        const rubrics: Array<RubricListItem & { examId?: string | null; lifecycleStatus?: RubricLifecycleStatus }> = [];
        let skippedInvalid = 0;

        for (const record of records) {
            try {
                const rubric = parseStoredRubric(record.rubric);
                rubrics.push({
                    questionId: rubric.metadata.questionId,
                    title: rubric.metadata.title,
                    totalScore: getRubricTotalScore(rubric),
                    pointCount: getRubricPointCount(rubric),
                    updatedAt: rubric.updatedAt,
                    examId: record.examId,
                    lifecycleStatus: normalizeLifecycleStatus(record.lifecycleStatus)
                });
            } catch {
                skippedInvalid += 1;
            }
        }

        return NextResponse.json({
            success: true,
            rubrics,
            skippedInvalid
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

export async function POST(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const deviceId = getDeviceId(request);
        const body = await request.json();

        let rawRubric = body.rubric || body;
        if (typeof rawRubric === 'string') {
            try {
                rawRubric = JSON.parse(rawRubric);
            } catch {
                return NextResponse.json({
                    success: false,
                    error: '无效的 JSON 字符串',
                    code: 'INVALID_JSON'
                }, { status: 400 });
            }
        }

        const validation = validateRubricJSON(rawRubric);
        if (!validation.valid || !validation.rubric) {
            console.warn('[Rubric API] Validation failed:', validation.errors);
            return rubricSchemaErrorResponse('评分细则必须为 Rubric v3 格式', validation.errors, 400);
        }

        const rubric = validation.rubric;
        const questionKey = body.questionKey || rubric.metadata.questionId;
        const examId = body.examId || rubric.metadata.examId || null;
        const lifecycleStatus = normalizeLifecycleStatus(body.lifecycleStatus);

        const existing = await prisma.deviceRubric.findUnique({
            where: {
                activationCode_questionKey: { activationCode: identifier, questionKey }
            }
        });

        if (existing) {
            try {
                const serverRubric = parseStoredRubric(existing.rubric);
                const serverTime = new Date(serverRubric.updatedAt).getTime();
                const clientTime = new Date(rubric.updatedAt).getTime();

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
                // 服务端历史非 v3 数据不参与冲突检测，直接覆盖
            }
        }

        const now = new Date().toISOString();
        const rubricToSave: RubricJSONV3 = {
            ...rubric,
            updatedAt: now,
            createdAt: rubric.createdAt || now,
            metadata: {
                ...rubric.metadata,
                examId: examId || rubric.metadata.examId || null
            }
        };

        await prisma.deviceRubric.upsert({
            where: {
                activationCode_questionKey: { activationCode: identifier, questionKey }
            },
            update: {
                rubric: JSON.stringify(rubricToSave),
                deviceId: deviceId || undefined,
                examId: examId || undefined,
                lifecycleStatus
            },
            create: {
                activationCode: identifier,
                deviceId: deviceId || null,
                questionKey,
                rubric: JSON.stringify(rubricToSave),
                examId: examId || null,
                lifecycleStatus
            }
        });

        // 防误发布：已发布模板被编辑后，强制回退到 draft
        if (lifecycleStatus !== 'published') {
            await prisma.rubricTemplate.updateMany({
                where: {
                    scope: 'user',
                    activationCode: identifier,
                    questionKey,
                    lifecycleStatus: 'published'
                },
                data: {
                    lifecycleStatus: 'draft'
                }
            });
        }

        console.log(`[Rubric API] Saved: ${questionKey} (Exam: ${examId}) for ${formatIdentifierForLog(identifier)}`);

        return NextResponse.json({
            success: true,
            rubric: rubricToSave,
            examId,
            lifecycleStatus
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
