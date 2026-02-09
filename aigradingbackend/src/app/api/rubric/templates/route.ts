/**
 * 评分细则模板库 API
 * GET /api/rubric/templates
 * POST /api/rubric/templates
 * DELETE /api/rubric/templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateRubricV3 } from '@/lib/rubric-v3';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

function toDbJson(value: unknown) {
    if (!isSqlite) return value as any;
    return JSON.stringify(value ?? {});
}

function fromDbJson<T>(value: unknown): T | null {
    if (typeof value !== 'string') return (value as T) ?? null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
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

export async function GET(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const url = new URL(request.url);
        const scope = url.searchParams.get('scope') || 'all';
        const subject = url.searchParams.get('subject');
        const grade = url.searchParams.get('grade');
        const questionType = url.searchParams.get('questionType');
        const strategyType = url.searchParams.get('strategyType');

        const baseWhere: any = {};
        if (subject) baseWhere.subject = subject;
        if (grade) baseWhere.grade = grade;
        if (questionType) baseWhere.questionType = questionType;
        if (strategyType) baseWhere.strategyType = strategyType;

        const queries = [];
        if (scope === 'system' || scope === 'all') {
            queries.push(prisma.rubricTemplate.findMany({
                where: { ...baseWhere, scope: 'system' },
                orderBy: { updatedAt: 'desc' }
            }));
        }
        if (scope === 'user' || scope === 'all') {
            queries.push(prisma.rubricTemplate.findMany({
                where: { ...baseWhere, scope: 'user', activationCode: identifier },
                orderBy: { updatedAt: 'desc' }
            }));
        }

        const results = (await Promise.all(queries)).flat();
        const normalized = results.map((tpl) => ({
            ...tpl,
            metadata: fromDbJson(tpl.metadata),
            content: fromDbJson(tpl.content)
        }));
        return apiSuccess({ templates: normalized }, '获取模板成功');
    } catch (error) {
        console.error('[Rubric Template API] GET error:', error);
        return apiServerError('获取模板失败');
    }
}

export async function POST(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const body = await request.json();
        const payload = body.template || body;

        const scope = payload.scope === 'system' ? 'system' : 'user';
        const activationCode = scope === 'user' ? identifier : null;

        const rubricCandidate = {
            version: '3.0',
            metadata: payload.metadata,
            strategyType: payload.strategyType,
            content: payload.content,
            constraints: payload.constraints || [],
            createdAt: payload.createdAt || new Date().toISOString(),
            updatedAt: payload.updatedAt || new Date().toISOString()
        };

        const validation = validateRubricV3(rubricCandidate);
        if (!validation.valid) {
            return apiError(`格式错误: ${validation.errors.join(', ')}`);
        }

        const rubric = validation.rubric!;

        const created = await prisma.rubricTemplate.create({
            data: {
                scope,
                activationCode,
                subject: rubric.metadata.subject || null,
                grade: rubric.metadata.grade || null,
                questionType: rubric.metadata.questionType || null,
                strategyType: rubric.strategyType,
                version: rubric.version,
                metadata: toDbJson(rubric.metadata),
                content: toDbJson(rubric.content)
            }
        });

        const normalized = {
            ...created,
            metadata: fromDbJson(created.metadata),
            content: fromDbJson(created.content)
        };
        return apiSuccess({ template: normalized }, '创建模板成功');
    } catch (error) {
        console.error('[Rubric Template API] POST error:', error);
        return apiServerError('创建模板失败');
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) {
            return apiError('缺少必填参数（id）');
        }

        const existing = await prisma.rubricTemplate.findUnique({ where: { id } });
        if (!existing) {
            return apiError('模板不存在', 404);
        }

        if (existing.scope === 'user' && existing.activationCode !== identifier) {
            return apiError('没有权限删除该模板', 403);
        }

        await prisma.rubricTemplate.delete({ where: { id } });
        return apiSuccess({ id }, '删除模板成功');
    } catch (error) {
        console.error('[Rubric Template API] DELETE error:', error);
        return apiServerError('删除模板失败');
    }
}
