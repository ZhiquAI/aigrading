import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getActivationCode(request: NextRequest): string | null {
    return request.headers.get('x-activation-code');
}

/**
 * PUT /api/exams/[id]
 * 修改考试信息
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const activationCode = getActivationCode(request);
        const { id } = params;

        if (!activationCode) {
            return NextResponse.json({ success: false, error: '缺少激活码' }, { status: 400 });
        }

        const body = await request.json();
        const { name, date, subject, grade, description } = body;

        const exam = await prisma.exam.update({
            where: { id, activationCode },
            data: {
                name,
                date: date ? new Date(date) : null,
                subject,
                grade,
                description
            }
        });

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
        const activationCode = getActivationCode(request);
        const { id } = params;

        if (!activationCode) {
            return NextResponse.json({ success: false, error: '缺少激活码' }, { status: 400 });
        }

        // 1. 删除考试记录
        await prisma.exam.delete({
            where: { id, activationCode }
        });

        // 2. 将关联的题目设为“未归类” (examId = null)
        await prisma.deviceRubric.updateMany({
            where: { activationCode, examId: id },
            data: { examId: null }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Exams API] DELETE error:', error);
        return NextResponse.json({ success: false, error: '删除考试失败' }, { status: 500 });
    }
}
