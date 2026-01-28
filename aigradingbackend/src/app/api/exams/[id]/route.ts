import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    return `${identifier.substring(0, 8)}...`;
}

/**
 * PUT /api/exams/[id]
 * 修改考试信息
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const identifier = getUserIdentifier(request);
        const { id } = params;

        const body = await request.json();
        const { name, date, subject, grade, description } = body;

        const exam = await prisma.exam.update({
            where: { id, activationCode: identifier },
            data: {
                name,
                date: date ? new Date(date) : null,
                subject,
                grade,
                description
            }
        });

        console.log(`[Exams API] Updated exam: ${name} (${formatIdentifierForLog(identifier)})`);

        return NextResponse.json({ success: true, exam });
    } catch (error) {
        console.error('[Exams API] PUT error:', error);
        return NextResponse.json({ success: false, error: '修改考试失败' }, { status: 500 });
    }
}

/**
 * DELETE /api/exams/[id]
 * 删除考试
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const identifier = getUserIdentifier(request);
        const { id } = params;

        // 1. 删除考试记录
        await prisma.exam.delete({
            where: { id, activationCode: identifier }
        });

        // 2. 将关联的题目设为"未归类" (examId = null)
        await prisma.deviceRubric.updateMany({
            where: { activationCode: identifier, examId: id },
            data: { examId: null }
        });

        console.log(`[Exams API] Deleted exam: ${id} (${formatIdentifierForLog(identifier)})`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Exams API] DELETE error:', error);
        return NextResponse.json({ success: false, error: '删除考试失败' }, { status: 500 });
    }
}
