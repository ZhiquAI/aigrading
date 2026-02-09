/**
 * AI 评分细则推荐 API (基础规则匹配版)
 * POST /api/ai/rubric/recommend
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, apiServerError } from '@/lib/api-response';

function fromDbJson<T>(value: unknown): T | null {
    if (typeof value !== 'string') return (value as T) ?? null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function extractKeywords(text?: string): string[] {
    if (!text) return [];
    return text
        .split(/[\s,，。；;、]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            subject,
            questionType,
            strategyType,
            keywords,
            answerText,
            questionText
        } = body || {};

        if (!subject && !questionType && !strategyType && !answerText && !questionText && !keywords) {
            return apiError('请提供题干/答案文本或筛选条件');
        }

        const keywordList = Array.isArray(keywords) ? keywords : extractKeywords(answerText || questionText);

        const where: any = {
            scope: 'system'
        };
        if (subject) where.subject = subject;
        if (questionType) where.questionType = questionType;
        if (strategyType) where.strategyType = strategyType;

        const templates = await prisma.rubricTemplate.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 50
        });

        const scored = templates.map((tpl) => {
            const meta = (fromDbJson(tpl.metadata) || tpl.metadata || {}) as any;
            const content = (fromDbJson(tpl.content) || tpl.content || {}) as any;
            const points = Array.isArray(content.points) ? content.points : [];
            const pointText = points.map((p: any) => `${p.content || ''} ${(p.keywords || []).join(' ')}`).join(' ');
            let score = 0;
            for (const key of keywordList) {
                if (meta.title?.includes(key)) score += 2;
                if (pointText.includes(key)) score += 1;
            }
            return { template: tpl, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 5).map((item) => item.template);

        return apiSuccess({ templates: top }, '推荐模板成功');
    } catch (error) {
        console.error('[Rubric Recommend API] Error:', error);
        return apiServerError('推荐模板失败');
    }
}
