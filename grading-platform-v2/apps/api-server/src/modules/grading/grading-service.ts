import type { PrismaClient } from "@prisma/client";
import type { ScopeIdentity } from "@ai-grading/api-contracts";
import { callAiGatewayJson, isAiGatewayError, type AiProviderAttempt } from "@ai-grading/ai-gateway";
import {
  buildActivationScopeKey,
  fromFlatBreakdown,
  normalizeNonEmpty,
  type GradingResult
} from "@ai-grading/domain-core";
import { RubricDomainError } from "@/modules/rubric/rubric-service";
import type { AiGatewayOverrides } from "@/modules/settings/ai-runtime-service";

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

type BreakdownItem = {
  label: string;
  score: number;
  max: number;
  comment: string;
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
    metadata?: { totalScore?: unknown };
    segments?: Array<Record<string, unknown>>;
    answerPoints?: Array<{ score?: unknown; content?: unknown }>;
    content?: { points?: Array<{ score?: unknown; label?: unknown }> };
    maxScore?: unknown;
    totalScore?: unknown;
  };

  const metadataTotal = Number(obj.metadata?.totalScore);
  if (Number.isFinite(metadataTotal) && metadataTotal > 0) {
    return metadataTotal;
  }

  const fromField = Number(obj.maxScore ?? obj.totalScore);
  if (Number.isFinite(fromField) && fromField > 0) {
    return fromField;
  }

  if (Array.isArray(obj.segments) && obj.segments.length > 0) {
    const segmentTotal = obj.segments.reduce((sum, segment) => {
      const record = segment && typeof segment === "object" ? segment as Record<string, unknown> : null;
      const score = Number(record?.maxScore);
      return Number.isFinite(score) ? sum + score : sum;
    }, 0);

    if (segmentTotal > 0) {
      return segmentTotal;
    }
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

const buildBreakdownFromSegments = (segments: Array<Record<string, unknown>>): BreakdownItem[] => {
  const rows: BreakdownItem[] = [];

  segments.forEach((segment, segmentIndex) => {
    const content = (
      segment.content && typeof segment.content === "object" && !Array.isArray(segment.content)
        ? segment.content
        : {}
    ) as Record<string, unknown>;

    const segmentTitle = normalizeNonEmpty(
      typeof segment.title === "string" ? segment.title : undefined
    ) ?? `题段${segmentIndex + 1}`;

    const beforeSize = rows.length;

    const pushRow = (label: string, max: number): void => {
      const normalizedMax = Number.isFinite(max) && max > 0 ? max : 1;
      rows.push({
        label,
        score: normalizedMax,
        max: normalizedMax,
        comment: "规则评估：命中要点"
      });
    };

    const points = Array.isArray(segment.points)
      ? segment.points
      : Array.isArray(content.points)
        ? content.points
        : Array.isArray(content.steps)
          ? content.steps
          : [];

    points.forEach((point, pointIndex) => {
      if (!point || typeof point !== "object") {
        return;
      }

      const row = point as Record<string, unknown>;
      const label = normalizeNonEmpty(
        typeof row.content === "string"
          ? row.content
          : typeof row.label === "string"
            ? row.label
            : undefined
      ) ?? `${segmentTitle}-要点${pointIndex + 1}`;
      const max = Number(row.score);
      pushRow(label, max);
    });

    const dimensions = Array.isArray(content.dimensions) ? content.dimensions : [];
    dimensions.forEach((dimension, dimensionIndex) => {
      if (!dimension || typeof dimension !== "object") {
        return;
      }

      const row = dimension as Record<string, unknown>;
      const levels = Array.isArray(row.levels) ? row.levels : [];
      const levelMax = levels.reduce((max, level) => {
        if (!level || typeof level !== "object") {
          return max;
        }

        const score = Number((level as Record<string, unknown>).score);
        return Number.isFinite(score) && score > max ? score : max;
      }, 0);
      const weight = Number(row.weight);
      const weightedMax = Number.isFinite(weight) && weight > 0 ? levelMax * weight : levelMax;
      const label = normalizeNonEmpty(typeof row.name === "string" ? row.name : undefined) ?? `${segmentTitle}-维度${dimensionIndex + 1}`;
      pushRow(`${segmentTitle}-${label}`, weightedMax);
    });

    if (rows.length === beforeSize) {
      const max = Number(segment.maxScore);
      pushRow(segmentTitle, max);
    }
  });

  return rows;
};

const buildBreakdown = (rubric: unknown): BreakdownItem[] => {
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
    segments?: Array<Record<string, unknown>>;
    answerPoints?: Array<{ score?: unknown; content?: unknown }>;
    content?: { points?: Array<{ score?: unknown; label?: unknown; comment?: unknown }> };
  };

  if (Array.isArray(obj.segments) && obj.segments.length > 0) {
    const segmentBreakdown = buildBreakdownFromSegments(
      obj.segments.filter((segment): segment is Record<string, unknown> => Boolean(segment) && typeof segment === "object")
    );
    if (segmentBreakdown.length > 0) {
      return segmentBreakdown;
    }
  }

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

const buildMarkdownComment = (breakdown: BreakdownItem[]): string => {
  return [
    "| 项目 | 得分 | 说明 |",
    "|---|---|---|",
    ...breakdown.map((item) => `| ${item.label} | ${item.score}/${item.max} | ${item.comment} |`)
  ].join("\n");
};

const toGradingResult = (input: {
  studentName?: string;
  questionNo?: string;
  questionKey?: string;
  examNo?: string;
  score: number;
  maxScore: number;
  comment: string;
  breakdown: BreakdownItem[];
  provider: string;
  remaining: number;
  totalUsed: number;
}): GradingResult => {
  return {
    ...fromFlatBreakdown({
      id: crypto.randomUUID(),
      studentName: input.studentName ?? "未知",
      questionNo: input.questionNo ?? (input.questionKey ?? "未识别"),
      questionKey: input.questionKey ?? "unknown",
      examNo: input.examNo ?? "unknown",
      score: input.score,
      maxScore: input.maxScore,
      comment: input.comment,
      breakdown: input.breakdown,
      provider: input.provider,
      timestamp: Date.now()
    }),
    remaining: input.remaining,
    totalUsed: input.totalUsed
  };
};

const normalizeBreakdownFromAi = (candidate: unknown): BreakdownItem[] => {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as {
        label?: unknown;
        score?: unknown;
        max?: unknown;
        comment?: unknown;
      };

      const label = normalizeNonEmpty(typeof row.label === "string" ? row.label : undefined);
      if (!label) {
        return null;
      }

      const rawScore = Number(row.score);
      const rawMax = Number(row.max);

      const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1;
      const score =
        Number.isFinite(rawScore) && rawScore >= 0
          ? Math.min(rawScore, max)
          : 0;

      return {
        label,
        score,
        max,
        comment:
          normalizeNonEmpty(typeof row.comment === "string" ? row.comment : undefined) ??
          "AI 评分结果"
      };
    })
    .filter((item): item is BreakdownItem => Boolean(item));
};

const evaluateWithAiGateway = async (input: {
  rubric: unknown;
  studentName?: string;
  questionNo?: string;
  questionKey?: string;
  examNo?: string;
  imageBase64?: string;
  gatewayOverrides?: AiGatewayOverrides;
}): Promise<{
  score: number;
  maxScore: number;
  breakdown: BreakdownItem[];
  comment: string;
  provider: string;
}> => {
  const rubricText = JSON.stringify(input.rubric);
  const maxScoreFromRubric = computeMaxScoreFromRubric(input.rubric);

  const systemPrompt = [
    "你是一名高中历史阅卷老师。",
    "请根据评分细则给学生答案评分。",
    "只返回 JSON 对象，不要输出 markdown。",
    "JSON 字段必须包含：score, maxScore, breakdown, comment。",
    "breakdown 是数组，元素包含：label, score, max, comment。"
  ].join("\n");

  const userPrompt = [
    `学生姓名: ${input.studentName ?? "未知"}`,
    `题号: ${input.questionNo ?? input.questionKey ?? "未提供"}`,
    `准考证号: ${input.examNo ?? "未提供"}`,
    `评分细则: ${rubricText}`
  ].join("\n");

  const images = input.imageBase64
    ? [
        {
          base64: input.imageBase64,
          label: "【学生答案图片】"
        }
      ]
    : [];

  const gatewayResult = await callAiGatewayJson({
    task: "grading_evaluate",
    systemPrompt,
    userPrompt,
    images,
    preferredProviders: input.gatewayOverrides?.preferredProviders,
    runtime: input.gatewayOverrides?.runtime,
    temperature: 0.1,
    maxTokens: 1200
  });

  const root = (
    typeof gatewayResult.json.result === "object" &&
    gatewayResult.json.result &&
    !Array.isArray(gatewayResult.json.result)
      ? gatewayResult.json.result
      : gatewayResult.json
  ) as Record<string, unknown>;

  const breakdown = normalizeBreakdownFromAi(root.breakdown);
  if (breakdown.length === 0) {
    throw new GradingDomainError("AI_OUTPUT_INVALID", "AI 返回评分结构无效", 502);
  }

  const maxScoreRaw = Number(root.maxScore);
  const maxScore =
    Number.isFinite(maxScoreRaw) && maxScoreRaw > 0
      ? maxScoreRaw
      : Math.max(
          maxScoreFromRubric,
          breakdown.reduce((sum, item) => sum + item.max, 0)
        );

  const scoreRaw = Number(root.score);
  const scoreFromBreakdown = breakdown.reduce((sum, item) => sum + item.score, 0);
  const score =
    Number.isFinite(scoreRaw) && scoreRaw >= 0
      ? Math.min(scoreRaw, maxScore)
      : Math.min(scoreFromBreakdown, maxScore);

  const comment =
    normalizeNonEmpty(typeof root.comment === "string" ? root.comment : undefined) ??
    buildMarkdownComment(breakdown);

  return {
    score,
    maxScore,
    breakdown,
    comment,
    provider: `${gatewayResult.provider}:${gatewayResult.model}`
  };
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
    imageBase64?: string;
    gatewayOverrides?: AiGatewayOverrides;
  }
): Promise<{
  score: number;
  maxScore: number;
  breakdown: BreakdownItem[];
  comment: string;
  provider: string;
  gradingResult: GradingResult;
  providerTrace: {
    mode: "ai" | "fallback";
    reason?: string;
    attempts?: AiProviderAttempt[];
  };
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

  let score = 0;
  let maxScore = 0;
  let breakdown: BreakdownItem[] = [];
  let comment = "";
  let provider = "rule-evaluator";
  let providerTrace: {
    mode: "ai" | "fallback";
    reason?: string;
    attempts?: AiProviderAttempt[];
  } = {
    mode: "fallback",
    reason: "AI_GATEWAY_NOT_CALLED"
  };

  try {
    const aiResult = await evaluateWithAiGateway({
      rubric: input.rubric,
      studentName: input.studentName,
      questionNo: input.questionNo,
      questionKey: input.questionKey,
      examNo: input.examNo,
      imageBase64: input.imageBase64,
      gatewayOverrides: input.gatewayOverrides
    });

    score = aiResult.score;
    maxScore = aiResult.maxScore;
    breakdown = aiResult.breakdown;
    comment = aiResult.comment;
    provider = aiResult.provider;
    providerTrace = {
      mode: "ai"
    };
  } catch (error) {
    maxScore = computeMaxScoreFromRubric(input.rubric);
    breakdown = buildBreakdown(input.rubric);
    score = Math.min(
      maxScore,
      breakdown.reduce((sum, item) => sum + item.score, 0)
    );
    comment = buildMarkdownComment(breakdown);
    providerTrace =
      isAiGatewayError(error)
        ? {
            mode: "fallback",
            reason: error.code,
            attempts: error.attempts
          }
        : {
            mode: "fallback",
            reason: "AI_GATEWAY_UNKNOWN_ERROR"
          };
  }

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
    provider,
    gradingResult: toGradingResult({
      studentName: input.studentName,
      questionNo: input.questionNo,
      questionKey: input.questionKey,
      examNo: input.examNo,
      score,
      maxScore,
      comment,
      breakdown,
      provider,
      remaining: updatedQuota.remaining,
      totalUsed: quota.total - updatedQuota.remaining
    }),
    providerTrace,
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
