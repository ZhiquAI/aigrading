import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getActivationCode(request: NextRequest): string | null {
    return request.headers.get('x-activation-code');
}

/**
 * GET /api/exams
 * 获取考试列表
 */
export async function GET(request: NextRequest) {
    try {
        const activationCode = getActivationCode(request);
        if (!activationCode) {
            return NextResponse.json({ success: true, exams: [] });
        }

        const exams = await prisma.exam.findMany({
            where: { activationCode },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json({ success: true, exams });
    } catch (error) {
        console.error('[Exams API] GET error:', error);
        return NextResponse.json({ success: false, error: '获取考试列表失败' }, { status: 500 });
    }
}

/**
 * POST /api/exams
 * 创建新考试
 */
export async function POST(request: NextRequest) {
    try {
        const activationCode = getActivationCode(request);
        if (!activationCode) {
            return NextResponse.json({ success: false, error: '缺少激活码' }, { status: 400 });
        }

        const body = await request.json();
        const { name, date, subject, grade, description } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: '考试名称不能为空' }, { status: 400 });
        }

        const exam = await prisma.exam.create({
            data: {
                activationCode,
                name,
                date: date ? new Date(date) : null,
                subject,
                grade,
                description
            }
        });

        console.log(`[Exams API] Created exam: ${name} (code: ${activationCode.substring(0, 8)})`);

        return NextResponse.json({ success: true, exam });
    } catch (error) {
        console.error('[Exams API] POST error:', error);
        return NextResponse.json({ success: false, error: '创建考试失败' }, { status: 500 });
    }
}
