/**
 * AI 批改代理 API
 * 接收批改请求，优先调用 Gemini API，失败时回退到智谱 API
 * 使用配额系统管理使用次数
 */

import { prisma } from '@/lib/prisma';
import { gradeWithZhipu, GradeRequest } from '@/lib/zhipu';
import { gradeWithGPT } from '@/lib/gpt';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

// 获取或创建设备配额
async function getOrCreateDeviceQuota(deviceId: string) {
    let quota = await prisma.deviceQuota.findUnique({
        where: { deviceId }
    });

    if (!quota) {
        quota = await prisma.deviceQuota.create({
            data: {
                deviceId,
                quota: 300  // 免费300次
            }
        });
    }

    return quota;
}

// 扣减配额
async function deductQuota(deviceId: string): Promise<boolean> {
    const quota = await prisma.deviceQuota.findUnique({
        where: { deviceId }
    });

    if (!quota || quota.quota <= 0) {
        return false;
    }

    await prisma.deviceQuota.update({
        where: { deviceId },
        data: {
            quota: { decrement: 1 },
            totalUsed: { increment: 1 }
        }
    });

    // 记录使用
    await prisma.usageRecord.create({
        data: { deviceId }
    });

    return true;
}

/**
 * POST /api/ai/grade
 * 批改学生答案（优先使用 Gemini，失败时回退到智谱）
 */
export async function POST(request: Request) {
    try {
        // 获取设备 ID
        const deviceId = request.headers.get('x-device-id');
        if (!deviceId) {
            return apiError('缺少设备标识');
        }

        // 解析请求体
        const body = await request.json();
        const { imageBase64, rubric, studentName, questionNo, strategy } = body;

        if (!imageBase64) {
            return apiError('请提供学生答案图片');
        }

        if (!rubric) {
            return apiError('请提供评分细则');
        }

        // 获取设备配额
        const deviceQuota = await getOrCreateDeviceQuota(deviceId);

        // 检查配额
        if (deviceQuota.quota <= 0) {
            return apiError('配额已用完，请购买更多配额', 403);
        }

        // 构建批改请求
        const gradeRequest: GradeRequest = {
            imageBase64,
            rubric,
            studentName,
            questionNo
        };

        // 策略选择
        const validStrategies = ['flash', 'pro', 'reasoning'];
        // @ts-ignore
        const gradeStrategy = validStrategies.includes(strategy) ? strategy : 'pro';
        console.log(`[Grade API] Strategy: ${gradeStrategy}, Primary: Zhipu GLM-4.6V`);

        let result;
        let provider: string = 'zhipu';

        try {
            // 优先使用智谱 GLM-4.6V（国内直连，速度快）
            result = await gradeWithZhipu(gradeRequest);
        } catch (zhipuError) {
            console.warn(`Zhipu failed, falling back to GPT-4o:`, zhipuError);
            provider = 'gpt';

            // Fallback 到 GPT-4o (通过代理)
            try {
                // @ts-ignore
                result = await gradeWithGPT(gradeRequest, gradeStrategy);
            } catch (gptError) {
                console.error('All providers failed. GPT error:', gptError);
                throw zhipuError;
            }
        }

        // 扣减配额
        await deductQuota(deviceId);

        // 获取更新后的配额
        const updatedQuota = await prisma.deviceQuota.findUnique({
            where: { deviceId }
        });

        return apiSuccess({
            ...result,
            provider,
            remaining: updatedQuota?.quota || 0,
            totalUsed: updatedQuota?.totalUsed || 0
        }, '批改完成');

    } catch (error) {
        console.error('Grade API error:', error);

        if (error instanceof Error) {
            if (error.message.includes('API Key')) {
                return apiServerError('AI 服务暂时不可用');
            }
            return apiServerError(error.message);
        }

        return apiServerError('批改失败，请重试');
    }
}

/**
 * GET /api/ai/grade
 * 获取剩余配额
 */
export async function GET(request: Request) {
    try {
        const deviceId = request.headers.get('x-device-id');
        if (!deviceId) {
            return apiError('缺少设备标识');
        }

        const deviceQuota = await getOrCreateDeviceQuota(deviceId);

        // 检查是否有付费激活
        const paidActivations = await prisma.activationCode.count({
            where: { usedBy: deviceId }
        });

        return apiSuccess({
            isPaid: paidActivations > 0,
            quota: deviceQuota.quota,
            totalUsed: deviceQuota.totalUsed
        });

    } catch (error) {
        console.error('Get usage error:', error);
        return apiServerError('查询失败');
    }
}
