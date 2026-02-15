import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * GET /api/admin/codes
 * 获取激活码列表
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'all';
        const search = searchParams.get('search');
        const type = searchParams.get('type');

        // 构建查询条件
        const where: any = {};

        if (filter === 'unused') {
            where.usedBy = null;
        } else if (filter === 'used') {
            where.usedBy = { not: null };
        }

        if (search) {
            where.code = { contains: search };
        }

        if (type && type !== 'all') {
            where.type = type;
        }

        const codes = await prisma.activationCode.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            success: true,
            data: { codes }
        });
    } catch (error) {
        console.error('[Admin Codes] Error:', error);
        return NextResponse.json({
            success: false,
            message: '获取激活码列表失败'
        }, { status: 500 });
    }
}

/**
 * POST /api/admin/codes
 * 创建新激活码
 */
export async function POST(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const body = await request.json();
        const {
            type = 'trial',
            quota,
            reusable,
            maxDevices,
            count = 1
        } = body;

        const allowedTypes = new Set(['trial', 'basic', 'standard', 'pro', 'agency']);
        if (!allowedTypes.has(type)) {
            return NextResponse.json({
                success: false,
                message: '无效的激活码类型'
            }, { status: 400 });
        }

        const normalizedQuota = Number(quota);
        const normalizedCount = Number(count);
        const normalizedMaxDevices = Number(maxDevices ?? 1);

        if (!Number.isInteger(normalizedQuota) || normalizedQuota <= 0) {
            return NextResponse.json({
                success: false,
                message: '配额必须是大于 0 的整数'
            }, { status: 400 });
        }

        if (!Number.isInteger(normalizedCount) || normalizedCount < 1 || normalizedCount > 100) {
            return NextResponse.json({
                success: false,
                message: '生成数量必须在 1-100 之间'
            }, { status: 400 });
        }

        if (!Number.isInteger(normalizedMaxDevices) || normalizedMaxDevices < 1 || normalizedMaxDevices > 100) {
            return NextResponse.json({
                success: false,
                message: '设备上限必须在 1-100 之间'
            }, { status: 400 });
        }

        const createdCodes = [];
        const localGenerated = new Set<string>();

        // 单次请求批量创建，避免前端循环请求触发限流
        for (let i = 0; i < normalizedCount; i += 1) {
            const newCode = await createActivationCodeWithRetry({
                type,
                quota: normalizedQuota,
                reusable: Boolean(reusable),
                maxDevices: normalizedMaxDevices,
                localGenerated
            });
            createdCodes.push(newCode);
        }

        return NextResponse.json({
            success: true,
            data: normalizedCount === 1 ? createdCodes[0] : createdCodes,
            count: createdCodes.length
        });
    } catch (error) {
        console.error('[Admin Codes] Create error:', error);
        return NextResponse.json({
            success: false,
            message: '创建激活码失败'
        }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/codes
 * 禁用激活码
 */
export async function PATCH(request: NextRequest) {
    try {
        const auth = requireAdmin(request);
        if (auth instanceof Response) {
            return auth;
        }

        const body = await request.json();
        const { code, status } = body;

        const updated = await prisma.activationCode.update({
            where: { code },
            data: { status }
        });

        return NextResponse.json({
            success: true,
            data: updated
        });
    } catch (error) {
        console.error('[Admin Codes] Update error:', error);
        return NextResponse.json({
            success: false,
            message: '更新激活码失败'
        }, { status: 500 });
    }
}

// 生成激活码辅助函数
function generateActivationCode(type: string): string {
    const prefix = type.toUpperCase().substring(0, 4);
    const random = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${random()}-${random()}-${random()}`;
}

type CreateCodeParams = {
    type: string;
    quota: number;
    reusable: boolean;
    maxDevices: number;
    localGenerated: Set<string>;
};

async function createActivationCodeWithRetry(params: CreateCodeParams) {
    const { type, quota, reusable, maxDevices, localGenerated } = params;
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const code = generateActivationCode(type);
        if (localGenerated.has(code)) {
            continue;
        }

        try {
            const created = await prisma.activationCode.create({
                data: {
                    code,
                    type,
                    quota,
                    reusable,
                    maxDevices
                }
            });
            localGenerated.add(code);
            return created;
        } catch (error: unknown) {
            // 唯一键冲突重试，其它错误直接抛出
            const isUniqueConflict =
                typeof error === 'object'
                && error !== null
                && 'code' in error
                && (error as { code?: string }).code === 'P2002';

            if (isUniqueConflict) {
                continue;
            }
            throw error;
        }
    }

    throw new Error('生成激活码失败：重试次数超过上限');
}
