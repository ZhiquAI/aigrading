/**
 * grading-result.ts - AI 批改结果类型定义
 *
 * 设计原则：
 * - 与 RubricV4 的 Segment 结构一一对应
 * - 每个 SegmentResult 知道自己来自哪种策略（point_accumulation / sequential_logic / rubric_matrix）
 * - 结果层只描述"AI 判了什么 + 判了多少分"，不包含 Rubric 定义（通过 ID 关联）
 * - 向后兼容：v3 单段细则的结果可以自然表达为单 SegmentResult
 */

import type { StrategyType, SegmentAggregation } from '../rubric/rubric-v4';

// ── 得分点级别结果 ──

/** 积分制 (point_accumulation) 下每个得分点的 AI 判定 */
export interface PointItemResult {
    /** 对应 RubricPointV4.id */
    pointId: string;
    /** 得分点标签/内容（从 Rubric 复制，便于 UI 展示无需回查 Rubric） */
    label: string;
    /** AI 判定得分 */
    score: number;
    /** 该得分点满分 */
    maxScore: number;
    /** AI 是否判定为命中 */
    matched: boolean;
    /** AI 给出的判定理由 */
    comment?: string;
    /** AI 匹配到的学生原文片段（用于 OCR 高亮回溯） */
    matchedText?: string;
    /** AI 判定的置信度 (0-1) */
    confidence?: number;
}

/** 逻辑链 (sequential_logic) 下每个步骤的 AI 判定 */
export interface StepItemResult {
    /** 对应 SequentialLogicStepV4.id */
    stepId: string;
    label: string;
    score: number;
    maxScore: number;
    matched: boolean;
    comment?: string;
    matchedText?: string;
    confidence?: number;
    /** 是否因为前置步骤未命中而被跳过 */
    skippedByDependency?: boolean;
}

/** 评分矩阵 (rubric_matrix) 下每个维度的 AI 判定 */
export interface DimensionItemResult {
    /** 对应 RubricDimensionV4.id */
    dimensionId: string;
    /** 维度名称 */
    dimensionName: string;
    /** AI 选中的等级标签 */
    selectedLevel: string;
    score: number;
    maxScore: number;
    comment?: string;
    confidence?: number;
}

// ── 段级别结果 ──

/** 单个 Segment 的批改结果，与 SegmentV4 一一对应 */
export interface SegmentResult {
    /** 对应 SegmentV4.id */
    segmentId: string;
    /** Segment 标题（从 Rubric 复制） */
    title: string;
    /** 策略类型（决定 items 的具体形状） */
    strategyType: StrategyType;
    /** 该 Segment 的 AI 判定总得分 */
    score: number;
    /** 该 Segment 满分 */
    maxScore: number;
    /** 该 Segment 的 AI 总结评语 */
    comment?: string;
    /** 得分点/步骤/维度的逐项结果 */
    items: SegmentItemResult[];
}

/**
 * Segment 内的逐项结果，按策略类型区分。
 * UI 层可以通过 type 字段决定渲染方式。
 */
export type SegmentItemResult =
    | ({ type: 'point' } & PointItemResult)
    | ({ type: 'step' } & StepItemResult)
    | ({ type: 'dimension' } & DimensionItemResult);

// ── 主结果 ──

/** AI 批改的完整结果（一道题 = 一个 GradingResult） */
export interface GradingResult {
    /** 唯一标识（通常 = timestamp 或后端返回的 ID） */
    id: string;
    /** 学生姓名 */
    studentName: string;
    /** 题号 */
    questionNo: string;
    /** 题目标识 key */
    questionKey: string;
    /** 考试编号 */
    examNo: string;

    /** AI 判定总得分 */
    score: number;
    /** 满分 */
    maxScore: number;
    /** AI 总结性评语 */
    comment: string;

    /** 多 Segment 结果（与 RubricV4.segments 一一对应） */
    segments: SegmentResult[];
    /** Segment 间的聚合方式（从 Rubric 复制） */
    segmentAggregation: SegmentAggregation;

    /** AI 服务商信息 */
    provider?: string;
    /** AI 模型名 */
    model?: string;
    /** 批改耗时（毫秒） */
    durationMs?: number;
    /** 时间戳 */
    timestamp: number;

    /** 剩余额度（从后端返回） */
    remaining?: number;
    /** 总使用量（从后端返回） */
    totalUsed?: number;
}

// ── 兼容 v1 扁平 breakdown 的转换型 ──

/**
 * 扁平化的得分项（用于不感知 Segment 结构的简易 UI 场景）。
 * 可由 flattenGradingResult() 从 GradingResult 生成。
 */
export interface FlatBreakdownItem {
    label: string;
    score: number;
    maxScore: number;
    comment?: string;
    /** 标记为扣分项 */
    isNegative?: boolean;
    /** 来源 Segment 的 ID（用于回溯） */
    segmentId?: string;
    /** 来源 Segment 的标题 */
    segmentTitle?: string;
}

// ── 工具函数 ──

/** 将 GradingResult 的多 Segment 结构扁平化为 FlatBreakdownItem[] */
export function flattenGradingResult(result: GradingResult): FlatBreakdownItem[] {
    const items: FlatBreakdownItem[] = [];

    for (const segment of result.segments) {
        for (const item of segment.items) {
            switch (item.type) {
                case 'point':
                    items.push({
                        label: item.label,
                        score: item.score,
                        maxScore: item.maxScore,
                        comment: item.comment,
                        isNegative: item.score === 0 && item.maxScore > 0,
                        segmentId: segment.segmentId,
                        segmentTitle: segment.title,
                    });
                    break;
                case 'step':
                    items.push({
                        label: item.label,
                        score: item.score,
                        maxScore: item.maxScore,
                        comment: item.skippedByDependency
                            ? `[跳过] ${item.comment || '前置步骤未通过'}`
                            : item.comment,
                        isNegative: item.score === 0 && item.maxScore > 0,
                        segmentId: segment.segmentId,
                        segmentTitle: segment.title,
                    });
                    break;
                case 'dimension':
                    items.push({
                        label: `${item.dimensionName}: ${item.selectedLevel}`,
                        score: item.score,
                        maxScore: item.maxScore,
                        comment: item.comment,
                        segmentId: segment.segmentId,
                        segmentTitle: segment.title,
                    });
                    break;
            }
        }
    }

    return items;
}

/**
 * 从 v1 扁平 breakdown 数组构建单 Segment 的 GradingResult。
 * 用于向后兼容旧数据 / v3 Rubric 的批改结果。
 */
export function fromFlatBreakdown(params: {
    id: string;
    studentName: string;
    questionNo: string;
    questionKey: string;
    examNo: string;
    score: number;
    maxScore: number;
    comment: string;
    breakdown: Array<{ label: string; score: number; max: number; comment?: string; isNegative?: boolean }>;
    provider?: string;
    durationMs?: number;
    timestamp?: number;
}): GradingResult {
    const pointItems: SegmentItemResult[] = params.breakdown.map((item, idx) => ({
        type: 'point' as const,
        pointId: `legacy-${idx}`,
        label: item.label,
        score: item.score,
        maxScore: item.max,
        matched: item.score > 0,
        comment: item.comment,
    }));

    return {
        id: params.id,
        studentName: params.studentName,
        questionNo: params.questionNo,
        questionKey: params.questionKey,
        examNo: params.examNo,
        score: params.score,
        maxScore: params.maxScore,
        comment: params.comment,
        segments: [{
            segmentId: 'default',
            title: '评分详情',
            strategyType: 'point_accumulation',
            score: params.score,
            maxScore: params.maxScore,
            comment: params.comment,
            items: pointItems,
        }],
        segmentAggregation: 'sum',
        provider: params.provider,
        durationMs: params.durationMs,
        timestamp: params.timestamp ?? Date.now(),
    };
}
