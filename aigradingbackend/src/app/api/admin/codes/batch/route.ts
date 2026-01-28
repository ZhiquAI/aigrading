import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/admin/codes/batch
 * 批量操作激活码 (删除、启用、禁用)
 */
export async function POST(request: NextRequest) {
    try {
        // 验证管理员token
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
        }

        const body = await request.json();
        const { action, ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, message: '请选择要操作的激活码' }, { status: 400 });
        }

        let result;
        switch (action) {
            case 'delete':
                result = await prisma.activationCode.deleteMany({
                    where: { id: { in: ids } }
                });
                return NextResponse.json({
                    success: true,
                    message: `成功删除 ${result.count} 个激活码`
                });

            case 'enable':
                result = await prisma.activationCode.updateMany({
                    where: { id: { in: ids } },
                    data: { status: 'active' }
                });
                return NextResponse.json({
                    success: true,
                    message: `成功启用 ${result.count} 个激活码`
                });

            case 'disable':
                result = await prisma.activationCode.updateMany({
                    where: { id: { in: ids } },
                    data: { status: 'disabled' }
                });
                return NextResponse.json({
                    success: true,
                    message: `成功禁用 ${result.count} 个激活码`
                });

            default:
                return NextResponse.json({ success: false, message: '无效的操作类型' }, { status: 400 });
        }

    } catch (error) {
        console.error('[Admin Code Batch] Error:', error);
        return NextResponse.json({
            success: false,
            message: '批量操作失败'
        }, { status: 500 });
    }
}
