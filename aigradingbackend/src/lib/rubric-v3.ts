import { z } from 'zod';

export const StrategyTypeSchema = z.enum(['point_accumulation', 'sequential_logic', 'rubric_matrix']);
export type StrategyType = z.infer<typeof StrategyTypeSchema>;
export const SegmentAggregationSchema = z.enum(['sum', 'weighted_sum', 'max']);
export type SegmentAggregation = z.infer<typeof SegmentAggregationSchema>;

export const ScoringStrategySchema = z.object({
    type: z.enum(['pick_n', 'all', 'weighted']),
    maxPoints: z.number().int().positive().optional(),
    pointValue: z.number().positive().optional(),
    allowAlternative: z.boolean().optional().default(false),
    strictMode: z.boolean().optional().default(false),
    openEnded: z.boolean().optional().default(false)
}).strict();
export type ScoringStrategy = z.infer<typeof ScoringStrategySchema>;

export const PointSchema = z.object({
    id: z.string(),
    questionSegment: z.string().optional(),
    content: z.string(),
    keywords: z.array(z.string()).optional().default([]),
    requiredKeywords: z.array(z.string()).optional(),
    score: z.number(),
    deductionRules: z.string().optional(),
    openEnded: z.boolean().optional(),
    order: z.number().int().optional()
}).strict();
export type RubricPoint = z.infer<typeof PointSchema>;

const PointAccumulationContentBaseSchema = z.object({
    scoringStrategy: ScoringStrategySchema,
    points: z.array(PointSchema).min(1),
    totalScore: z.number().nonnegative().optional()
}).strict();
export type PointAccumulationContentBase = z.infer<typeof PointAccumulationContentBaseSchema>;

const SequentialLogicContentBaseSchema = z.object({
    scoringStrategy: ScoringStrategySchema,
    steps: z.array(PointSchema).min(1),
    requireOrder: z.boolean().optional(),
    totalScore: z.number().nonnegative().optional()
}).strict();
export type SequentialLogicContentBase = z.infer<typeof SequentialLogicContentBaseSchema>;

const RubricMatrixContentBaseSchema = z.object({
    dimensions: z.array(z.object({
        id: z.string(),
        name: z.string(),
        weight: z.number().positive().optional(),
        levels: z.array(z.object({
            label: z.string(),
            score: z.number(),
            description: z.string().optional()
        }).strict()).min(1)
    }).strict()).min(1),
    totalScore: z.number().nonnegative().optional()
}).strict();
export type RubricMatrixContentBase = z.infer<typeof RubricMatrixContentBaseSchema>;

const SegmentContentSchema = z.union([
    PointAccumulationContentBaseSchema,
    SequentialLogicContentBaseSchema,
    RubricMatrixContentBaseSchema
]);

export const RubricSegmentSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    strategyType: StrategyTypeSchema,
    content: SegmentContentSchema,
    maxScore: z.number().nonnegative().optional(),
    weight: z.number().positive().optional(),
    order: z.number().int().optional()
}).strict().superRefine((data, ctx) => {
    const { strategyType, content } = data;
    if (strategyType === 'point_accumulation' && !PointAccumulationContentBaseSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'segment.content 与 point_accumulation 不匹配' });
    }
    if (strategyType === 'sequential_logic' && !SequentialLogicContentBaseSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'segment.content 与 sequential_logic 不匹配' });
    }
    if (strategyType === 'rubric_matrix' && !RubricMatrixContentBaseSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'segment.content 与 rubric_matrix 不匹配' });
    }
});
export type RubricSegment = z.infer<typeof RubricSegmentSchema>;

export const PointAccumulationContentSchema = z.object({
    scoringStrategy: ScoringStrategySchema.optional(),
    points: z.array(PointSchema).min(1).optional(),
    totalScore: z.number().nonnegative().optional(),
    aggregation: SegmentAggregationSchema.optional(),
    segments: z.array(RubricSegmentSchema).min(1).optional()
}).strict().superRefine((data, ctx) => {
    const hasPoints = Array.isArray(data.points) && data.points.length > 0;
    const hasSegments = Array.isArray(data.segments) && data.segments.length > 0;

    if (!hasPoints && !hasSegments) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'point_accumulation 需要 points 或 segments' });
    }
    if (hasPoints && !data.scoringStrategy) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'point_accumulation 使用 points 时必须提供 scoringStrategy' });
    }
});
export type PointAccumulationContent = z.infer<typeof PointAccumulationContentSchema>;

export const SequentialLogicContentSchema = z.object({
    scoringStrategy: ScoringStrategySchema.optional(),
    steps: z.array(PointSchema).min(1).optional(),
    requireOrder: z.boolean().optional(),
    totalScore: z.number().nonnegative().optional(),
    aggregation: SegmentAggregationSchema.optional(),
    segments: z.array(RubricSegmentSchema).min(1).optional()
}).strict().superRefine((data, ctx) => {
    const hasSteps = Array.isArray(data.steps) && data.steps.length > 0;
    const hasSegments = Array.isArray(data.segments) && data.segments.length > 0;

    if (!hasSteps && !hasSegments) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sequential_logic 需要 steps 或 segments' });
    }
    if (hasSteps && !data.scoringStrategy) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sequential_logic 使用 steps 时必须提供 scoringStrategy' });
    }
});
export type SequentialLogicContent = z.infer<typeof SequentialLogicContentSchema>;

export const RubricMatrixContentSchema = z.object({
    dimensions: z.array(z.object({
        id: z.string(),
        name: z.string(),
        weight: z.number().positive().optional(),
        levels: z.array(z.object({
            label: z.string(),
            score: z.number(),
            description: z.string().optional()
        }).strict()).min(1)
    }).strict()).min(1).optional(),
    totalScore: z.number().nonnegative().optional(),
    aggregation: SegmentAggregationSchema.optional(),
    segments: z.array(RubricSegmentSchema).min(1).optional()
}).strict().superRefine((data, ctx) => {
    const hasDimensions = Array.isArray(data.dimensions) && data.dimensions.length > 0;
    const hasSegments = Array.isArray(data.segments) && data.segments.length > 0;

    if (!hasDimensions && !hasSegments) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rubric_matrix 需要 dimensions 或 segments' });
    }
});
export type RubricMatrixContent = z.infer<typeof RubricMatrixContentSchema>;

export const ConstraintSchema = z.object({
    id: z.string(),
    type: z.string(),
    description: z.string().optional(),
    penalty: z.object({
        per: z.number().optional(),
        max: z.number().optional()
    }).strict().optional(),
    config: z.record(z.any()).optional()
}).strict();
export type RubricConstraint = z.infer<typeof ConstraintSchema>;

export const MetadataSchema = z.object({
    questionId: z.string(),
    title: z.string(),
    subject: z.string().optional(),
    grade: z.string().optional(),
    questionType: z.string().optional(),
    examId: z.string().nullable().optional(),
    examName: z.string().optional(),
    tags: z.array(z.string()).optional()
}).strict();
export type RubricMetadata = z.infer<typeof MetadataSchema>;

export const RubricV3Schema = z.object({
    version: z.literal('3.0'),
    metadata: MetadataSchema,
    strategyType: StrategyTypeSchema,
    content: z.union([PointAccumulationContentSchema, SequentialLogicContentSchema, RubricMatrixContentSchema]),
    constraints: z.array(ConstraintSchema).optional(),
    createdAt: z.string(),
    updatedAt: z.string()
}).strict().superRefine((data, ctx) => {
    const { strategyType, content } = data;
    if (strategyType === 'point_accumulation' && !PointAccumulationContentSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'content 与 point_accumulation 不匹配' });
    }
    if (strategyType === 'sequential_logic' && !SequentialLogicContentSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'content 与 sequential_logic 不匹配' });
    }
    if (strategyType === 'rubric_matrix' && !RubricMatrixContentSchema.safeParse(content).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'content 与 rubric_matrix 不匹配' });
    }
}).superRefine((data, ctx) => {
    const raw = data as unknown as Record<string, unknown>;
    const forbiddenTopLevelFields = ['questionId', 'title', 'totalScore', 'scoringStrategy', 'answerPoints', 'gradingNotes', 'legacy'];
    for (const key of forbiddenTopLevelFields) {
        if (key in raw) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `检测到旧版字段: ${key}` });
        }
    }
    const content = raw.content;
    if (content && typeof content === 'object') {
        const contentRecord = content as Record<string, unknown>;
        const forbiddenContentFields = ['answerPoints', 'gradingNotes'];
        for (const key of forbiddenContentFields) {
            if (key in contentRecord) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `检测到 content 旧版字段: ${key}` });
            }
        }
    }
});

export type RubricJSONV3 = z.infer<typeof RubricV3Schema>;

export function validateRubricV3(data: unknown): { valid: boolean; errors: string[]; rubric?: RubricJSONV3 } {
    const parsed = RubricV3Schema.safeParse(data);
    if (!parsed.success) {
        return { valid: false, errors: parsed.error.errors.map((e) => e.message) };
    }
    return { valid: true, errors: [], rubric: parsed.data };
}
