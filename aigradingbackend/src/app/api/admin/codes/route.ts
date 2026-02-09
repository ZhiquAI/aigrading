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
        const { type, quota, reusable, maxDevices } = body;

        // 生成激活码
        const code = generateActivationCode(type);

        const newCode = await prisma.activationCode.create({
            data: {
                code,
                type,
                quota,
                reusable: reusable || false,
                maxDevices: maxDevices || 1
            }
        });

        return NextResponse.json({
            success: true,
            data: newCode
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
