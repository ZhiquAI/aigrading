/**
 * AI 批改代理 API
 * 接收批改请求，执行“AI 判定 + 代码算分”
 * 使用配额系统管理使用次数
 */

import { prisma } from '@/lib/prisma';
import { judgeWithZhipu } from '@/lib/zhipu';
import { judgeWithGPT } from '@/lib/gpt';
import { judgeWithGemini, isGeminiAvailable } from '@/lib/gemini';
import { scoreRubric } from '@/lib/score-engine';
import { validateRubricV3 } from '@/lib/rubric-v3';

import { apiSuccess, apiError, apiServerError, apiRateLimited, ErrorCode } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createRequestLogger } from '@/lib/logger';

// 获取可用配额信息
async function getAvailableQuota(deviceId: string, activationCode?: string | null) {
    // 1. 优先检查激活码配额 (共享账号)
    if (activationCode) {
        const code = await prisma.activationCode.findUnique({
            where: { code: activationCode }
        });
        // 允许获取非 active 状态的码，由调用方逻辑决定是否可用
        if (code) {
            return {
                id: code.id,
                type: 'code',
                remaining: code.remaining,
                total: code.quota,
                used: code.used,
                status: code.status // 新增状态返回
            };
        }
    }

    // 2. 无码或码无效，回退到设备免费配额
    let deviceQuota = await prisma.deviceQuota.findUnique({
        where: { deviceId }
    });

    if (!deviceQuota) {
        deviceQuota = await prisma.deviceQuota.create({
            data: {
                deviceId,
                remaining: 10,
                total: 10,
                used: 0
            }
        });
    }

    return {
        id: deviceId,
        type: 'device',
        remaining: deviceQuota.remaining,
        total: deviceQuota.total,
        used: deviceQuota.used,
        status: 'active'
    };
}

// 扣减配额
async function deductQuota(id: string, type: 'code' | 'device', deviceId: string, activationCode?: string | null) {
    if (type === 'code') {
        const updatedCode = await prisma.activationCode.update({
            where: { id },
            data: {
                remaining: { decrement: 1 },
                used: { increment: 1 }
            }
        });

        // 如果是试用码且额度用完，自动标记为过期 (Suggestion 3)
        if (updatedCode.type === 'trial' && updatedCode.remaining <= 0) {
            await prisma.activationCode.update({
                where: { id },
                data: { status: 'expired' }
            });
            console.log(`[Quota] Trial code ${id} marked as EXPIRED.`);
        }
    } else {
        await prisma.deviceQuota.update({
            where: { deviceId: id },
            data: {
                remaining: { decrement: 1 },
                used: { increment: 1 }
            }
        });
    }

    // 记录使用
    await prisma.usageRecord.create({
        data: {
            deviceId: deviceId,
            activationCode: type === 'code' ? id : (activationCode || null),
            metadata: JSON.stringify({ quotaType: type })
        }
    });
}

/**
 * POST /api/ai/grade
 * 批改学生答案（仅支持 Rubric v3）
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

        // 获取可用配额
        const quotaInfo = await getAvailableQuota(deviceId, activationCode);

        // 检查配额与状态
        if (quotaInfo.status !== 'active') {
            return apiError(quotaInfo.status === 'expired' ? '配额已耗尽，试用期结束' : '激活码状态异常', 403);
        }

        if (quotaInfo.remaining <= 0) {
            return apiError('配额已用完，请购买更多配额', 403);
        }

        // 解析评分细则（严格 v3）
        let rubricPayload: unknown = rubric;
        if (typeof rubricPayload === 'string') {
            try {
                rubricPayload = JSON.parse(rubricPayload);
            } catch {
                return apiError('评分细则必须为合法 JSON', 400, ErrorCode.RUBRIC_FORMAT_INVALID);
            }
        }
        const rubricValidation = validateRubricV3(rubricPayload);
        if (!rubricValidation.valid || !rubricValidation.rubric) {
            return apiError(
                `评分细则必须为 Rubric v3 格式: ${rubricValidation.errors.join(', ')}`,
                400,
                ErrorCode.RUBRIC_FORMAT_INVALID
            );
        }
        const rubricV3 = rubricValidation.rubric;

        // 策略选择
        type GradeStrategy = 'flash' | 'pro' | 'reasoning';
        const validStrategies = new Set<GradeStrategy>(['flash', 'pro', 'reasoning']);
        const gradeStrategy: GradeStrategy = validStrategies.has(strategy as GradeStrategy)
            ? (strategy as GradeStrategy)
            : 'flash';

        let result: ReturnType<typeof scoreRubric> | null = null;
        let provider: string = 'unknown';
        const aiStartTime = Date.now();

        // 优先级：GPTSAPI (GPT-4o) → Zhipu (GLM-4) → Gemini
        try {
            console.log(`[Grade API] 判定模式: GPTSAPI, 策略: ${gradeStrategy}`);
            const judge = await judgeWithGPT({ imageBase64, rubric: rubricV3, studentName }, gradeStrategy);
            result = scoreRubric(rubricV3, judge.judge);
            provider = 'gptsapi-judge';
        } catch (gptError: any) {
            console.warn('[Grade API] GPT Judge 失败:', gptError.message);
            try {
                console.log('[Grade API] 回退到智谱判定');
                const judge = await judgeWithZhipu({ imageBase64, rubric: rubricV3, studentName });
                result = scoreRubric(rubricV3, judge.judge);
                provider = 'zhipu-judge';
            } catch (zhipuError: any) {
                console.warn('[Grade API] 智谱 Judge 失败:', zhipuError.message);
                if (isGeminiAvailable()) {
                    try {
                        console.log('[Grade API] 回退到 Gemini 判定');
                        const judge = await judgeWithGemini({ imageBase64, rubric: rubricV3, studentName }, gradeStrategy);
                        result = scoreRubric(rubricV3, judge.judge);
                        provider = 'gemini-judge';
                    } catch (geminiError: any) {
                        console.error('[Grade API] Gemini Judge 失败:', geminiError.message);
                    }
                }
            }
        }

        // 如果所有判定服务都失败
        if (!result) {
            console.error(`[Grade API] 所有 AI 服务均失败，总耗时: ${Date.now() - aiStartTime}ms`);
            throw new Error('AI 判定服务暂时不可用，请稍后重试');
        }

        // 扣减配额
        await deductQuota(quotaInfo.id, quotaInfo.type as 'code' | 'device', deviceId, activationCode);

        // 获取更新后的配额信息进行展示
        const updatedQuota = quotaInfo.type === 'code'
            ? await prisma.activationCode.findUnique({ where: { id: quotaInfo.id } })
            : await prisma.deviceQuota.findUnique({ where: { deviceId: quotaInfo.id } });

        // 规范 comment 字段（判定模式使用 breakdown 汇总）
        const commentText = Array.isArray(result.breakdown)
            ? [
                '| 项目 | 得分 | 说明 |',
                '|---|---|---|',
                ...result.breakdown.map((item) => `| ${item.label} | ${item.score}/${item.max} | ${item.comment || ''} |`)
            ].join('\n')
            : null;

        // 如果有激活码，异步存储批改记录
        if (activationCode && result) {
            prisma.gradingRecord.create({
                data: {
                    activationCode,
                    deviceId,
                    questionNo: questionNo || null,
                    questionKey: questionKey || null,
                    studentName: studentName || '未知',
                    examNo: examNo || null,
                    score: Number(result.score) || 0,
                    maxScore: Number(result.maxScore) || 0,
                    comment: commentText,
                    breakdown: result.breakdown
                        ? (typeof result.breakdown === 'string' ? result.breakdown : JSON.stringify(result.breakdown))
                        : null
                }
            }).then(() => {
                console.log(`[Grade API] Record saved for ${activationCode.substring(0, 10)}...`);
            }).catch(recordError => {
                console.warn('[Grade API] Failed to save record:', recordError);
            });
        }

        return apiSuccess({
            ...result,
            comment: commentText,
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
        const activationCode = request.headers.get('x-activation-code');
        const quotaInfo = await getAvailableQuota(deviceId, activationCode);

        return apiSuccess({
            isPaid: quotaInfo.type === 'code',
            quota: quotaInfo.remaining,
            totalUsed: quotaInfo.used,
            status: quotaInfo.status
        });

    } catch (error) {
        console.error('Get usage error:', error);
        return apiServerError('查询失败');
    }
}
