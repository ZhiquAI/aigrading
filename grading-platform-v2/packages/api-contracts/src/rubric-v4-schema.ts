/**
 * rubric-v4-schema.ts - 评分细则 v4 Zod 校验 Schema
 *
 * 基于 v3 的 rubric-v3.ts Zod 模式扩展，核心改进：
 * - Segment.content 使用 Union + superRefine 交叉校验
 * - 新增 GlobalPolicy、MatchingConfig
 * - 精简 MatchMode（移除 formula）
 * - 旧版字段检测
 */
import { z } from 'zod';

// ── 枚举 Schema ──

export const strategyTypeV4Schema = z.enum(['point_accumulation', 'sequential_logic', 'rubric_matrix']);

export const segmentAggregationV4Schema = z.enum(['sum', 'weighted_sum', 'max']);

export const matchModeV4Schema = z.enum(['strict', 'keyword', 'semantic']);

export const scoringTypeV4Schema = z.enum(['all', 'pick_n', 'weighted']);

export const constraintTypeV4Schema = z.enum(['deduction_fixed', 'deduction_per_count', 'score_cap', 'logic_check']);

export const questionTypeV4Schema = z.enum(['single', 'mixed']);

export const ocrToleranceV4Schema = z.enum(['low', 'medium', 'high']);

export const conflictPolicyV4Schema = z.enum(['checkpoints_first', 'segments_first']);

// ── 基础结构 Schema ──

export const scoringStrategyV4Schema = z.object({
    type: scoringTypeV4Schema,
    maxPoints: z.number().int().positive().optional(),
    pointValue: z.number().positive().optional(),
    allowAlternative: z.boolean().optional(),
    strictMode: z.boolean().optional(),
}).strict();

export const matchingConfigV4Schema = z.object({
    mode: matchModeV4Schema,
    strictMode: z.boolean().optional(),
    allowAlternative: z.boolean().optional(),
}).strict();

export const constraintV4Schema = z.object({
    id: z.string().min(1),
    type: constraintTypeV4Schema,
    config: z.record(z.unknown()),
}).strict();

// ── 段内内容 Schema（Union 结构） ──

export const rubricPointV4Schema = z.object({
    id: z.string().min(1),
    content: z.string().min(1),
    score: z.number(),
    keywords: z.array(z.string()).optional(),
    questionSegment: z.string().optional(),
    requiredKeywords: z.array(z.string()).optional(),
    deductionRules: z.string().optional(),
    openEnded: z.boolean().optional(),
    order: z.number().int().optional(),
}).strict();

export const pointAccumulationContentV4Schema = z.object({
    scoringStrategy: scoringStrategyV4Schema,
    points: z.array(rubricPointV4Schema).min(1),
    totalScore: z.number().nonnegative().optional(),
}).strict();

export const sequentialLogicStepV4Schema = z.object({
    id: z.string().min(1),
    content: z.string().min(1),
    score: z.number(),
    dependsOn: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    order: z.number().int().optional(),
}).strict();

export const sequentialLogicContentV4Schema = z.object({
    scoringStrategy: scoringStrategyV4Schema,
    steps: z.array(sequentialLogicStepV4Schema).min(1),
    requireOrder: z.boolean().optional(),
    totalScore: z.number().nonnegative().optional(),
}).strict();

export const rubricDimensionLevelV4Schema = z.object({
    label: z.string().min(1),
    score: z.number(),
    description: z.string().optional(),
}).strict();

export const rubricDimensionV4Schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    weight: z.number().positive().optional(),
    levels: z.array(rubricDimensionLevelV4Schema).min(1),
}).strict();

export const rubricMatrixContentV4Schema = z.object({
    dimensions: z.array(rubricDimensionV4Schema).min(1),
    totalScore: z.number().nonnegative().optional(),
}).strict();

const segmentContentV4Schema = z.union([
    pointAccumulationContentV4Schema,
    sequentialLogicContentV4Schema,
    rubricMatrixContentV4Schema,
]);

// ── Segment Schema（含 superRefine 交叉校验） ──

export const segmentV4Schema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    questionType: z.string().min(1),
    strategyType: strategyTypeV4Schema,
    maxScore: z.number().nonnegative(),
    weight: z.number().positive().optional(),
    matching: matchingConfigV4Schema,
    scoring: scoringStrategyV4Schema,
    content: segmentContentV4Schema,
    constraints: z.array(constraintV4Schema).optional(),
}).strict().superRefine((data, ctx) => {
    const { strategyType, content } = data;

    if (strategyType === 'point_accumulation' && !pointAccumulationContentV4Schema.safeParse(content).success) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `segment "${data.id}": content 与 point_accumulation 策略不匹配`,
        });
    }
    if (strategyType === 'sequential_logic' && !sequentialLogicContentV4Schema.safeParse(content).success) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `segment "${data.id}": content 与 sequential_logic 策略不匹配`,
        });
    }
    if (strategyType === 'rubric_matrix' && !rubricMatrixContentV4Schema.safeParse(content).success) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `segment "${data.id}": content 与 rubric_matrix 策略不匹配`,
        });
    }
});

// ── 全局策略 Schema ──

export const globalPolicyV4Schema = z.object({
    conflictPolicy: conflictPolicyV4Schema,
    minConfidence: z.number().min(0).max(1),
    ocrTolerance: ocrToleranceV4Schema,
}).strict();

// ── 元数据 Schema ──

export const rubricMetadataV4Schema = z.object({
    subject: z.string().min(1),
    grade: z.string().optional(),
    examName: z.string().optional(),
    questionId: z.string().min(1),
    questionType: questionTypeV4Schema,
    totalScore: z.number().positive(),
    tags: z.array(z.string()).optional(),
}).strict();

// ── 主 Schema ──

export const rubricV4Schema = z.object({
    version: z.literal('4.0'),
    metadata: rubricMetadataV4Schema,
    globalPolicy: globalPolicyV4Schema,
    segments: z.array(segmentV4Schema).min(1),
    segmentAggregation: segmentAggregationV4Schema,
    constraints: z.array(constraintV4Schema).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
}).strict().superRefine((data, ctx) => {
    // 分值闭合校验：segments 总分应等于 metadata.totalScore
    const segmentTotal = data.segments.reduce((sum, seg) => sum + seg.maxScore, 0);
    if (data.segmentAggregation === 'sum' && segmentTotal !== data.metadata.totalScore) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `分值闭合校验失败: segments 总分 (${segmentTotal}) ≠ metadata.totalScore (${data.metadata.totalScore})`,
        });
    }

    // 旧版字段检测
    const raw = data as unknown as Record<string, unknown>;
    const forbiddenTopLevelFields = [
        'questionId', 'title', 'totalScore', 'scoringStrategy',
        'answerPoints', 'gradingNotes', 'legacy', 'strategyType',
        'aggregation',
    ];
    for (const key of forbiddenTopLevelFields) {
        if (key in raw) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `检测到旧版字段 "${key}"，请迁移为 v4 格式`,
            });
        }
    }
});

// ── 推导类型（从 Zod 推导，保持与纯类型文件一致） ──

export type RubricV4Inferred = z.infer<typeof rubricV4Schema>;
export type SegmentV4Inferred = z.infer<typeof segmentV4Schema>;
export type GlobalPolicyV4Inferred = z.infer<typeof globalPolicyV4Schema>;
export type RubricMetadataV4Inferred = z.infer<typeof rubricMetadataV4Schema>;
export type ConstraintV4Inferred = z.infer<typeof constraintV4Schema>;

// ── 校验函数 ──

export function validateRubricV4(data: unknown): {
    valid: boolean;
    errors: string[];
    rubric?: RubricV4Inferred;
} {
    const parsed = rubricV4Schema.safeParse(data);
    if (!parsed.success) {
        return {
            valid: false,
            errors: parsed.error.errors.map((e) => `[${e.path.join('.')}] ${e.message}`),
        };
    }
    return { valid: true, errors: [], rubric: parsed.data };
}
