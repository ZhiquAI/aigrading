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
 * GET /api/exams
 * 获取考试列表
 */
export async function GET(request: NextRequest) {
    try {
        const identifier = getUserIdentifier(request);

        const exams = await prisma.exam.findMany({
            where: { activationCode: identifier },
            orderBy: { date: 'desc' }
        });

        console.log(`[Exams API] GET - Found ${exams.length} exams for ${formatIdentifierForLog(identifier)}`);

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
        const identifier = getUserIdentifier(request);

        const body = await request.json();
        const { name, date, subject, grade, description } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: '考试名称不能为空' }, { status: 400 });
        }

        const exam = await prisma.exam.create({
            data: {
                activationCode: identifier,
                name,
                date: date ? new Date(date) : null,
                subject,
                grade,
                description
            }
        });

        console.log(`[Exams API] Created exam: ${name} (${formatIdentifierForLog(identifier)})`);

        return NextResponse.json({ success: true, exam });
    } catch (error) {
        console.error('[Exams API] POST error:', error);
        return NextResponse.json({ success: false, error: '创建考试失败' }, { status: 500 });
    }
}
