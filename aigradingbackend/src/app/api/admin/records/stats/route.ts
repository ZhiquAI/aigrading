/**
 * 批改记录统计分析 API
 * 
 * GET /api/admin/records/stats
 * 
 * Query 参数:
 * - questionNo: 题号筛选
 * - questionKey: 题目 Key 筛选
 * - activationCode: 激活码筛选
 * - startDate: 开始日期
 * - endDate: 结束日期
 * 
 * 响应:
 * {
 *   total: 总记录数,
 *   averageScore: 平均分,
 *   averagePercentage: 平均得分率,
 *   fullScoreCount: 满分数,
 *   fullScoreRate: 满分率,
 *   zeroScoreCount: 零分数,
 *   zeroScoreRate: 零分率,
 *   maxScore: 满分值,
 *   scoreDistribution: 分数分布
 * }
 */

import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

interface ScoreDistribution {
    range: string;
    count: number;
    percentage: number;
}

interface StatsResponse {
    success: boolean;
    data?: {
        total: number;
        averageScore: number;
        averagePercentage: number;
        fullScoreCount: number;
        fullScoreRate: number;
        zeroScoreCount: number;
        zeroScoreRate: number;
        maxScore: number;
        minScore: number;
        scoreDistribution: ScoreDistribution[];
        // 时间维度统计
        dailyStats?: { date: string; count: number; avgScore: number }[];
    };
    message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<StatsResponse>> {
    try {
        const { searchParams } = new URL(request.url);

        // 解析查询参数
        const questionNo = searchParams.get('questionNo');
        const questionKey = searchParams.get('questionKey');
        const activationCode = searchParams.get('activationCode');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const includeDailyStats = searchParams.get('daily') === 'true';

        // 构建查询条件
        const where: {
            questionNo?: string;
            questionKey?: string;
            activationCode?: string;
            createdAt?: { gte?: Date; lte?: Date };
        } = {};

        if (questionNo) where.questionNo = questionNo;
        if (questionKey) where.questionKey = questionKey;
        if (activationCode) where.activationCode = activationCode;
        if (startDate) {
            where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
        }
        if (endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        }

        // 查询所有符合条件的记录
        const records = await prisma.gradingRecord.findMany({
            where,
            select: {
                score: true,
                maxScore: true,
                createdAt: true
            }
        });

        if (records.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    total: 0,
                    averageScore: 0,
                    averagePercentage: 0,
                    fullScoreCount: 0,
                    fullScoreRate: 0,
                    zeroScoreCount: 0,
                    zeroScoreRate: 0,
                    maxScore: 0,
                    minScore: 0,
                    scoreDistribution: []
                }
            });
        }

        // 计算统计数据
        const total = records.length;
        const scores = records.map(r => r.score);
        const maxPossibleScore = Math.max(...records.map(r => r.maxScore));

        const totalScore = scores.reduce((sum, s) => sum + s, 0);
        const averageScore = totalScore / total;
        const averagePercentage = maxPossibleScore > 0
            ? (averageScore / maxPossibleScore) * 100
            : 0;

        // 满分和零分统计
        const fullScoreCount = records.filter(r => r.score >= r.maxScore).length;
        const zeroScoreCount = records.filter(r => r.score === 0).length;
        const fullScoreRate = (fullScoreCount / total) * 100;
        const zeroScoreRate = (zeroScoreCount / total) * 100;

        // 分数分布（按百分比分段）
        const distributionBuckets = [
            { min: 0, max: 20, label: '0-20%' },
            { min: 20, max: 40, label: '20-40%' },
            { min: 40, max: 60, label: '40-60%' },
            { min: 60, max: 80, label: '60-80%' },
            { min: 80, max: 100, label: '80-100%' }
        ];

        const scoreDistribution: ScoreDistribution[] = distributionBuckets.map(bucket => {
            const count = records.filter(r => {
                const percentage = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
                return percentage >= bucket.min && percentage < bucket.max;
            }).length;
            // 处理 100% 的记录
            const finalCount = bucket.max === 100
                ? count + records.filter(r => r.maxScore > 0 && (r.score / r.maxScore) * 100 === 100).length
                : count;
            return {
                range: bucket.label,
                count: finalCount,
                percentage: (finalCount / total) * 100
            };
        });

        // 修正 80-100% 区间的计数（包含满分）
        const last = scoreDistribution[scoreDistribution.length - 1];
        const perfectScores = records.filter(r => r.maxScore > 0 && r.score === r.maxScore).length;
        last.count = records.filter(r => {
            const pct = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
            return pct >= 80 && pct <= 100;
        }).length;
        last.percentage = (last.count / total) * 100;

        // 可选：每日统计
        let dailyStats;
        if (includeDailyStats) {
            const dailyMap = new Map<string, { count: number; totalScore: number }>();
            records.forEach(r => {
                const date = r.createdAt.toISOString().slice(0, 10);
                const existing = dailyMap.get(date) || { count: 0, totalScore: 0 };
                dailyMap.set(date, {
                    count: existing.count + 1,
                    totalScore: existing.totalScore + r.score
                });
            });
            dailyStats = Array.from(dailyMap.entries())
                .map(([date, data]) => ({
                    date,
                    count: data.count,
                    avgScore: data.totalScore / data.count
                }))
                .sort((a, b) => a.date.localeCompare(b.date));
        }

        return NextResponse.json({
            success: true,
            data: {
                total,
                averageScore: Math.round(averageScore * 100) / 100,
                averagePercentage: Math.round(averagePercentage * 10) / 10,
                fullScoreCount,
                fullScoreRate: Math.round(fullScoreRate * 10) / 10,
                zeroScoreCount,
                zeroScoreRate: Math.round(zeroScoreRate * 10) / 10,
                maxScore: maxPossibleScore,
                minScore: Math.min(...scores),
                scoreDistribution,
                ...(dailyStats && { dailyStats })
            }
        });
    } catch (error) {
        console.error('[Stats API] Error:', error);
        return NextResponse.json(
            { success: false, message: '统计分析失败' },
            { status: 500 }
        );
    }
}
