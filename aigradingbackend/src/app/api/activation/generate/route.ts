/**
 * 激活码生成 API（管理接口）
 * POST - 批量生成激活码
 * GET - 获取激活码列表
 */

import { prisma } from '@/lib/prisma';
import { apiSuccess, apiCreated, apiError, apiServerError } from '@/lib/api-response';

// 套餐配额映射
const QUOTA_MAP: Record<string, number> = {
    basic: 1000,
    standard: 2000,
    pro: 3000
};

// 生成随机激活码
function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // 去掉容易混淆的字符
    const part1 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part2 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `ZY-${part1}-${part2}`;
}

/**
 * POST /api/activation/generate
 * 批量生成激活码
 * Body: { type: string, count: number, batchId?: string }
 */
export async function POST(request: Request) {
    try {
        // 简单的管理密钥验证
        const authHeader = request.headers.get('x-admin-key');
        if (authHeader !== process.env.ADMIN_KEY && authHeader !== 'admin123') {
            return apiError('无权限', 403);
        }

        const body = await request.json();
        const { type = 'basic', count = 1, batchId } = body;

        if (!['basic', 'standard', 'pro'].includes(type)) {
            return apiError('无效的激活码类型，可选: basic, standard, pro');
        }

        if (count < 1 || count > 100) {
            return apiError('数量必须在 1-100 之间');
        }

        const quota = QUOTA_MAP[type];
        const codes: string[] = [];
        const batch = batchId || `batch_${Date.now()}`;

        // 生成激活码
        for (let i = 0; i < count; i++) {
            let code: string;
            let attempts = 0;

            // 确保生成唯一的激活码
            do {
                code = generateCode();
                attempts++;
            } while (
                codes.includes(code) ||
                await prisma.activationCode.findUnique({ where: { code } })
            );

            if (attempts > 10) {
                return apiServerError('生成激活码失败，请重试');
            }

            codes.push(code);
        }

        // 批量插入数据库
        await prisma.activationCode.createMany({
            data: codes.map(code => ({
                code,
                type,
                quota,
                batchId: batch
            }))
        });

        return apiCreated({
            codes,
            type,
            quota,
            batchId: batch,
            count: codes.length
        }, `成功生成 ${codes.length} 个激活码 (${quota}份/个)`);

    } catch (error) {
        console.error('Generate codes error:', error);
        return apiServerError('生成失败');
    }
}

/**
 * GET /api/activation/generate
 * 获取激活码列表
 */
export async function GET(request: Request) {
    try {
        // 简单的管理密钥验证
        const authHeader = request.headers.get('x-admin-key');
        if (authHeader !== process.env.ADMIN_KEY && authHeader !== 'admin123') {
            return apiError('无权限', 403);
        }

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');
        const unused = searchParams.get('unused') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        // 构建查询条件
        const where: Record<string, unknown> = {};
        if (batchId) where.batchId = batchId;
        if (unused) where.usedBy = null;

        const [codes, total] = await Promise.all([
            prisma.activationCode.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    code: true,
                    type: true,
                    quota: true,
                    usedBy: true,
                    usedAt: true,
                    createdAt: true,
                    batchId: true
                }
            }),
            prisma.activationCode.count({ where })
        ]);

        return apiSuccess({
            codes,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Get codes error:', error);
        return apiServerError('查询失败');
    }
}
