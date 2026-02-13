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

export const gradingEvaluateRequestSchema = z.object({
  imageBase64: z.string().trim().min(1).optional(),
  rubric: z.unknown(),
  studentName: z.string().trim().min(1).max(128).optional(),
  questionNo: z.string().trim().min(1).max(64).optional(),
  questionKey: z.string().trim().min(1).max(128).optional(),
  examNo: z.string().trim().min(1).max(64).optional()
});

export type GradingEvaluateRequest = z.infer<typeof gradingEvaluateRequestSchema>;

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().optional()
});

export type ApiError = z.infer<typeof apiErrorSchema>;
