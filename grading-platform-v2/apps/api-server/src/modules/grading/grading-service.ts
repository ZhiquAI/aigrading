import type { PrismaClient } from "@prisma/client";
import type { ScopeIdentity } from "@ai-grading/api-contracts";
import { buildActivationScopeKey } from "@ai-grading/domain-core";
import { RubricDomainError } from "@/modules/rubric/rubric-service";

export class GradingDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "GradingDomainError";
  }
}

export const isGradingDomainError = (error: unknown): error is GradingDomainError => {
  return error instanceof GradingDomainError;
};

type QuotaStatus = {
  remaining: number;
  totalUsed: number;
  isPaid: boolean;
  status: "active" | "expired" | "disabled";
};

const isActivationScope = (identity: ScopeIdentity): boolean => {
  return identity.scopeType === "activation" && Boolean(identity.activationCode);
};

const ensureActivationAvailability = async (
  db: PrismaClient,
  activationCode: string
): Promise<{ totalQuota: number }> => {
  const code = await db.licenseCode.findUnique({ where: { code: activationCode } });
  if (!code) {
    throw new GradingDomainError("INVALID_LICENSE_CODE", "激活码不存在", 404);
  }

  if (!code.isEnabled) {
    throw new GradingDomainError("LICENSE_DISABLED", "激活码已被禁用", 403);
  }

  if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
    throw new GradingDomainError("LICENSE_EXPIRED", "激活码已过期", 403);
  }

  return {
    totalQuota: code.totalQuota
  };
};

const ensureScopeQuota = async (
  db: PrismaClient,
  identity: ScopeIdentity
): Promise<{ scopeKey: string; remaining: number; total: number; isPaid: boolean }> => {
  if (isActivationScope(identity)) {
    const activationCode = identity.activationCode as string;
    const activationInfo = await ensureActivationAvailability(db, activationCode);

    const quota = await db.scopeQuota.upsert({
      where: {
        scopeKey: buildActivationScopeKey(activationCode)
      },
      update: {
        code: activationCode
      },
      create: {
        scopeKey: buildActivationScopeKey(activationCode),
        code: activationCode,
        remaining: activationInfo.totalQuota
      }
    });

    return {
      scopeKey: quota.scopeKey,
      remaining: quota.remaining,
      total: activationInfo.totalQuota,
      isPaid: true
    };
  }

  const freeQuotaDefault = 10;
  const quota = await db.scopeQuota.upsert({
    where: {
      scopeKey: identity.scopeKey
    },
    update: {},
    create: {
      scopeKey: identity.scopeKey,
      remaining: freeQuotaDefault
    }
  });

  return {
    scopeKey: quota.scopeKey,
    remaining: quota.remaining,
    total: freeQuotaDefault,
    isPaid: false
  };
};

const computeMaxScoreFromRubric = (rubric: unknown): number => {
  if (!rubric || typeof rubric !== "object") {
    return 10;
  }

  const obj = rubric as {
    answerPoints?: Array<{ score?: unknown; content?: unknown }>;
    content?: { points?: Array<{ score?: unknown; label?: unknown }> };
    maxScore?: unknown;
    totalScore?: unknown;
  };

  const fromField = Number(obj.maxScore ?? obj.totalScore);
  if (Number.isFinite(fromField) && fromField > 0) {
    return fromField;
  }

  const points = Array.isArray(obj.answerPoints)
    ? obj.answerPoints
    : Array.isArray(obj.content?.points)
      ? obj.content.points
      : [];

  if (points.length === 0) {
    return 10;
  }

  const pointTotal = points.reduce((sum, point) => {
    const score = Number(point?.score);
    return Number.isFinite(score) ? sum + score : sum;
  }, 0);

  return pointTotal > 0 ? pointTotal : 10;
};

const buildBreakdown = (rubric: unknown): Array<{ label: string; score: number; max: number; comment: string }> => {
  if (!rubric || typeof rubric !== "object") {
    return [
      {
        label: "总体评价",
        score: 10,
        max: 10,
        comment: "默认满分输出（占位评估）"
      }
    ];
  }

  const obj = rubric as {
    answerPoints?: Array<{ score?: unknown; content?: unknown }>;
    content?: { points?: Array<{ score?: unknown; label?: unknown; comment?: unknown }> };
  };

  const points = Array.isArray(obj.answerPoints)
    ? obj.answerPoints.map((item) => ({
        label: typeof item.content === "string" ? item.content : "要点",
        max: Number(item.score) || 1
      }))
    : Array.isArray(obj.content?.points)
      ? obj.content.points.map((item) => ({
          label: typeof item.label === "string" ? item.label : "要点",
          max: Number(item.score) || 1
        }))
      : [];

  if (points.length === 0) {
    return [
      {
        label: "总体评价",
        score: 10,
        max: 10,
        comment: "默认满分输出（占位评估）"
      }
    ];
  }

  return points.map((point) => ({
    label: point.label,
    score: point.max,
    max: point.max,
    comment: "规则评估：命中要点"
  }));
};

export const evaluateGrading = async (
  db: PrismaClient,
  input: {
    identity: ScopeIdentity;
    rubric: unknown;
    studentName?: string;
    questionNo?: string;
    questionKey?: string;
    examNo?: string;
    deviceId?: string;
  }
): Promise<{
  score: number;
  maxScore: number;
  breakdown: Array<{ label: string; score: number; max: number; comment: string }>;
  comment: string;
  provider: string;
  remaining: number;
  totalUsed: number;
}> => {
  if (!input.rubric) {
    throw new RubricDomainError("MISSING_RUBRIC", "请提供评分细则", 400);
  }

  const quota = await ensureScopeQuota(db, input.identity);

  if (quota.remaining <= 0) {
    throw new GradingDomainError("QUOTA_EXHAUSTED", "配额已用完，请购买更多配额", 403);
  }

  const maxScore = computeMaxScoreFromRubric(input.rubric);
  const breakdown = buildBreakdown(input.rubric);
  const score = Math.min(
    maxScore,
    breakdown.reduce((sum, item) => sum + item.score, 0)
  );

  const comment = [
    "| 项目 | 得分 | 说明 |",
    "|---|---|---|",
    ...breakdown.map((item) => `| ${item.label} | ${item.score}/${item.max} | ${item.comment} |`)
  ].join("\n");

  const updatedQuota = await db.$transaction(async (tx) => {
    const updated = await tx.scopeQuota.update({
      where: {
        scopeKey: quota.scopeKey
      },
      data: {
        remaining: {
          decrement: 1
        }
      }
    });

    await tx.gradingRecord.create({
      data: {
        scopeKey: input.identity.scopeKey,
        questionNo: input.questionNo ?? null,
        questionKey: input.questionKey ?? null,
        studentName: input.studentName ?? "未知",
        examNo: input.examNo ?? null,
        score,
        maxScore,
        comment,
        breakdown: JSON.stringify(breakdown),
        deviceId: input.deviceId ?? null
      }
    });

    return updated;
  });

  return {
    score,
    maxScore,
    breakdown,
    comment,
    provider: "rule-evaluator",
    remaining: updatedQuota.remaining,
    totalUsed: quota.total - updatedQuota.remaining
  };
};

export const getQuotaStatus = async (
  db: PrismaClient,
  identity: ScopeIdentity
): Promise<QuotaStatus> => {
  const quota = await ensureScopeQuota(db, identity);

  return {
    remaining: quota.remaining,
    totalUsed: quota.total - quota.remaining,
    isPaid: quota.isPaid,
    status: quota.remaining > 0 ? "active" : "expired"
  };
};
