/**
 * AI 批改代理 API
 * 接收批改请求，优先调用 Gemini API，失败时回退到智谱 API
 * 使用配额系统管理使用次数
 */

import { prisma } from '@/lib/prisma';
import { gradeWithZhipu, GradeRequest } from '@/lib/zhipu';
import { gradeWithGPT } from '@/lib/gpt';
import { apiSuccess, apiError, apiServerError, apiRateLimited, ErrorCode } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createRequestLogger } from '@/lib/logger';

// 获取或创建设备配额
async function getOrCreateDeviceQuota(deviceId: string) {
    let quota = await prisma.deviceQuota.findUnique({
        where: { deviceId }
    });

    if (!quota) {
        quota = await prisma.deviceQuota.create({
            data: {
                deviceId,
                remaining: 300,  // 免费300次
                total: 300,
                used: 0
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

    if (!quota || quota.remaining <= 0) {
        return false;
    }

    await prisma.deviceQuota.update({
        where: { deviceId },
        data: {
            remaining: { decrement: 1 },
            used: { increment: 1 }
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
    const reqLogger = createRequestLogger(request);

    try {
        // 速率限制检查
        const rateCheck = checkRateLimit(request, 'ai');
        if (!rateCheck.allowed) {
            reqLogger.warn('Rate limit exceeded', { clientId: rateCheck.clientId });
            const retryAfter = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
            return apiRateLimited(retryAfter);
        }

        // 获取设备 ID
        const deviceId = request.headers.get('x-device-id');
        if (!deviceId) {
            return apiError('缺少设备标识', 400, ErrorCode.INVALID_REQUEST);
        }

        // 获取激活码（可选，用于存储批改记录）
        const activationCode = request.headers.get('x-activation-code');

        // 解析请求体
        const body = await request.json();
        const { imageBase64, rubric, studentName, questionNo, questionKey, strategy, examNo } = body;

        if (!imageBase64) {
            return apiError('请提供学生答案图片');
        }

        if (!rubric) {
            return apiError('请提供评分细则');
        }

        // 获取设备配额
        const deviceQuota = await getOrCreateDeviceQuota(deviceId);

        // 检查配额
        if (deviceQuota.remaining <= 0) {
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

        // 如果有激活码，自动存储批改记录
        if (activationCode && result) {
            try {
                await prisma.gradingRecord.create({
                    data: {
                        activationCode,
                        deviceId,
                        questionNo: questionNo || null,
                        questionKey: questionKey || null,
                        studentName: studentName || '未知',
                        examNo: examNo || null,
                        score: Number(result.score) || 0,
                        maxScore: Number(result.maxScore) || 0,
                        comment: result.comment || null,
                        breakdown: result.breakdown
                            ? (typeof result.breakdown === 'string' ? result.breakdown : JSON.stringify(result.breakdown))
                            : null
                    }
                });
                console.log(`[Grade API] Record saved for ${activationCode.substring(0, 10)}...`);
            } catch (recordError) {
                // 存储失败不影响批改结果返回
                console.warn('[Grade API] Failed to save record:', recordError);
            }
        }

        return apiSuccess({
            ...result,
            provider,
            remaining: updatedQuota?.remaining || 0,
            totalUsed: updatedQuota?.used || 0
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
            quota: deviceQuota.remaining,
            totalUsed: deviceQuota.used
        });

    } catch (error) {
        console.error('Get usage error:', error);
        return apiServerError('查询失败');
    }
}
