/**
 * 配置同步 API
 * GET - 获取用户配置
 * PUT - 更新用户配置
 */

import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';
import { apiSuccess, apiUnauthorized, apiError, apiServerError } from '@/lib/api-response';

// 获取当前用户 ID 的辅助函数
async function getCurrentUserId(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    if (!token) return null;

    const payload = verifyToken(token);
    return payload?.userId || null;
}

/**
 * GET /api/sync/config
 * 获取用户配置
 * Query: ?key=xxx (可选，不传则返回全部)
 */
export async function GET(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (key) {
            // 获取指定配置
            const config = await prisma.config.findUnique({
                where: {
                    userId_key: { userId, key }
                },
                select: {
                    key: true,
                    value: true,
                    updatedAt: true
                }
            });

            if (!config) {
                return apiSuccess(null, '配置不存在');
            }

            return apiSuccess(config);
        } else {
            // 获取所有配置
            const configs = await prisma.config.findMany({
                where: { userId },
                select: {
                    key: true,
                    value: true,
                    updatedAt: true
                },
                orderBy: { updatedAt: 'desc' }
            });

            return apiSuccess(configs);
        }
    } catch (error) {
        console.error('Get config error:', error);
        return apiServerError('获取配置失败');
    }
}

/**
 * PUT /api/sync/config
 * 更新或创建配置
 * Body: { key: string, value: string }
 */
export async function PUT(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return apiError('key 和 value 为必填项');
        }

        // 使用 upsert：存在则更新，不存在则创建
        const config = await prisma.config.upsert({
            where: {
                userId_key: { userId, key }
            },
            update: {
                value: typeof value === 'string' ? value : JSON.stringify(value)
            },
            create: {
                userId,
                key,
                value: typeof value === 'string' ? value : JSON.stringify(value)
            },
            select: {
                key: true,
                value: true,
                updatedAt: true
            }
        });

        return apiSuccess(config, '配置已保存');
    } catch (error) {
        console.error('Update config error:', error);
        return apiServerError('保存配置失败');
    }
}

/**
 * DELETE /api/sync/config
 * 删除配置
 * Query: ?key=xxx
 */
export async function DELETE(request: Request) {
    try {
        const userId = await getCurrentUserId(request);
        if (!userId) {
            return apiUnauthorized();
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) {
            return apiError('请指定要删除的配置 key');
        }

        await prisma.config.deleteMany({
            where: { userId, key }
        });

        return apiSuccess(null, '配置已删除');
    } catch (error) {
        console.error('Delete config error:', error);
        return apiServerError('删除配置失败');
    }
}
