import { z } from "zod";

export const scopeTypeSchema = z.enum(["activation", "device", "anonymous"]);

export const activationCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);

export const deviceIdSchema = z.string().trim().min(3).max(128);

export const scopeIdentitySchema = z.object({
  scopeKey: z.string().min(1),
  scopeType: scopeTypeSchema,
  activationCode: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional()
});

export type ScopeIdentity = z.infer<typeof scopeIdentitySchema>;

export const licenseStatusSchema = z.enum([
  "active",
  "unactivated",
  "invalid",
  "disabled",
  "expired",
  "device_limit_reached"
]);

export const licenseActivateRequestSchema = z.object({
  activationCode: activationCodeSchema,
  deviceId: deviceIdSchema.optional()
});

export type LicenseActivateRequest = z.infer<typeof licenseActivateRequestSchema>;

export const licenseStatusDataSchema = z.object({
  identity: scopeIdentitySchema,
  licenseStatus: licenseStatusSchema,
  remainingQuota: z.number().int().nonnegative().optional(),
  maxDevices: z.number().int().positive().optional()
});

export const licenseStatusResponseSchema = z.object({
  ok: z.literal(true),
  data: licenseStatusDataSchema
});

export type LicenseStatusResponse = z.infer<typeof licenseStatusResponseSchema>;

export const licenseActivateResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    identity: scopeIdentitySchema,
    activated: z.boolean(),
    alreadyBound: z.boolean(),
    remainingQuota: z.number().int().nonnegative(),
    maxDevices: z.number().int().positive()
  })
});

export type LicenseActivateResponse = z.infer<typeof licenseActivateResponseSchema>;

export const settingKeySchema = z.string().trim().min(1).max(128);

export const settingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown())
]);

export const settingEntrySchema = z.object({
  key: settingKeySchema,
  value: z.string(),
  updatedAt: z.string().datetime()
});

export const settingUpsertRequestSchema = z.object({
  key: settingKeySchema,
  value: settingValueSchema
});

export type SettingUpsertRequest = z.infer<typeof settingUpsertRequestSchema>;

export const modelProviderSchema = z.enum(["openrouter", "openai", "gemini", "zhipu", "dashscope"]);

export const modelConnectionTestRequestSchema = z.object({
  provider: modelProviderSchema.optional(),
  endpoint: z.string().trim().min(1).max(2000).optional(),
  modelName: z.string().trim().min(1).max(256).optional(),
  apiKey: z.string().trim().min(1).max(4096).optional()
});

export type ModelConnectionTestRequest = z.infer<typeof modelConnectionTestRequestSchema>;

export const recordItemSchema = z.object({
  questionNo: z.string().trim().min(1).max(64).optional(),
  questionKey: z.string().trim().min(1).max(128).optional(),
  studentName: z.string().trim().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(128).optional(),
  examNo: z.string().trim().min(1).max(64).optional(),
  score: z.coerce.number(),
  maxScore: z.coerce.number(),
  comment: z.string().max(2000).optional(),
  breakdown: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional(),
  deviceId: deviceIdSchema.optional()
});

export const recordsBatchRequestSchema = z.object({
  records: z.array(recordItemSchema).min(1).max(100)
});

export type RecordsBatchRequest = z.infer<typeof recordsBatchRequestSchema>;

export const examCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
  date: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).max(64).optional(),
  grade: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().min(1).max(1000).optional()
});

export type ExamCreateRequest = z.infer<typeof examCreateRequestSchema>;

export const rubricLifecycleStatusSchema = z.enum(["draft", "published"]);

export const rubricUpsertRequestSchema = z.object({
  questionKey: z.string().trim().min(1).max(128).optional(),
  rubric: z.unknown(),
  examId: z.string().trim().min(1).max(128).nullable().optional(),
  lifecycleStatus: rubricLifecycleStatusSchema.optional()
});

export type RubricUpsertRequest = z.infer<typeof rubricUpsertRequestSchema>;

export const rubricGenerateRequestSchema = z.object({
  questionImage: z.string().optional(),
  answerImage: z.string().optional(),
  answerText: z.string().optional(),
  questionId: z.string().trim().min(1).max(128).optional(),
  subject: z.string().trim().min(1).max(64).optional(),
  questionType: z.string().trim().min(1).max(64).optional(),
  strategyType: z.string().trim().min(1).max(64).optional(),
  totalScore: z.number().positive().optional(),
  customRules: z.array(z.string()).optional()
});

export type RubricGenerateRequest = z.infer<typeof rubricGenerateRequestSchema>;

export const rubricStandardizeRequestSchema = z.object({
  rubric: z.union([
    z.string().trim().min(1),
    z.record(z.unknown())
  ]),
  maxScore: z.number().positive().optional()
});

export type RubricStandardizeRequest = z.infer<typeof rubricStandardizeRequestSchema>;

export const gradingEvaluateRequestSchema = z.object({
  imageBase64: z.string().trim().min(1).optional(),
  rubric: z.unknown(),
  studentName: z.string().trim().min(1).max(128).optional(),
  questionNo: z.string().trim().min(1).max(64).optional(),
  questionKey: z.string().trim().min(1).max(128).optional(),
  examNo: z.string().trim().min(1).max(64).optional()
});

export type GradingEvaluateRequest = z.infer<typeof gradingEvaluateRequestSchema>;

export const gradingBreakdownItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  score: z.coerce.number().nonnegative(),
  max: z.coerce.number().positive(),
  comment: z.string().trim().max(2000).default("")
});

export const gradingProviderAttemptSchema = z.object({
  provider: z.string().trim().min(1).max(128),
  model: z.string().trim().min(1).max(256).optional(),
  endpoint: z.string().trim().max(2000).optional(),
  statusCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  errorCode: z.string().trim().max(128).optional(),
  message: z.string().trim().min(1).max(2000)
});

export const gradingProviderTraceSchema = z.object({
  mode: z.enum(["ai", "fallback"]),
  reason: z.string().trim().max(200).optional(),
  attempts: z.array(gradingProviderAttemptSchema).optional()
});

const gradingStrategyTypeSchema = z.enum(["point_accumulation", "sequential_logic", "rubric_matrix"]);
const gradingSegmentAggregationSchema = z.enum(["sum", "weighted_sum", "max"]);

const gradingPointItemResultSchema = z.object({
  type: z.literal("point"),
  pointId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(200),
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  matched: z.boolean(),
  comment: z.string().trim().max(2000).optional(),
  matchedText: z.string().trim().max(5000).optional(),
  confidence: z.number().min(0).max(1).optional()
});

const gradingStepItemResultSchema = z.object({
  type: z.literal("step"),
  stepId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(200),
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  matched: z.boolean(),
  comment: z.string().trim().max(2000).optional(),
  matchedText: z.string().trim().max(5000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  skippedByDependency: z.boolean().optional()
});

const gradingDimensionItemResultSchema = z.object({
  type: z.literal("dimension"),
  dimensionId: z.string().trim().min(1).max(128),
  dimensionName: z.string().trim().min(1).max(200),
  selectedLevel: z.string().trim().min(1).max(128),
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  comment: z.string().trim().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional()
});

export const gradingSegmentItemResultSchema = z.discriminatedUnion("type", [
  gradingPointItemResultSchema,
  gradingStepItemResultSchema,
  gradingDimensionItemResultSchema
]);

export const gradingSegmentResultSchema = z.object({
  segmentId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(200),
  strategyType: gradingStrategyTypeSchema,
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  comment: z.string().trim().max(2000).optional(),
  items: z.array(gradingSegmentItemResultSchema)
});

export const gradingResultSchema = z.object({
  id: z.string().trim().min(1).max(128),
  studentName: z.string().trim().min(1).max(128),
  questionNo: z.string().trim().min(1).max(64),
  questionKey: z.string().trim().min(1).max(128),
  examNo: z.string().trim().min(1).max(128),
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  comment: z.string().max(4000),
  segments: z.array(gradingSegmentResultSchema).min(1),
  segmentAggregation: gradingSegmentAggregationSchema,
  provider: z.string().trim().min(1).max(256).optional(),
  model: z.string().trim().max(256).optional(),
  durationMs: z.number().nonnegative().optional(),
  timestamp: z.number().int().positive(),
  remaining: z.number().int().nonnegative().optional(),
  totalUsed: z.number().int().nonnegative().optional()
});

export type GradingResultContract = z.infer<typeof gradingResultSchema>;

export const gradingEvaluateDataSchema = z.object({
  score: z.coerce.number().nonnegative(),
  maxScore: z.coerce.number().nonnegative(),
  breakdown: z.array(gradingBreakdownItemSchema),
  comment: z.string().max(4000),
  provider: z.string().trim().min(1).max(256),
  providerTrace: gradingProviderTraceSchema,
  remaining: z.number().int().nonnegative(),
  totalUsed: z.number().int().nonnegative(),
  gradingResult: gradingResultSchema.optional()
});

export type GradingEvaluateData = z.infer<typeof gradingEvaluateDataSchema>;

export const gradingEvaluateResponseSchema = z.object({
  ok: z.literal(true),
  data: gradingEvaluateDataSchema
});

export type GradingEvaluateResponse = z.infer<typeof gradingEvaluateResponseSchema>;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().optional()
});

export type ApiError = z.infer<typeof apiErrorSchema>;
