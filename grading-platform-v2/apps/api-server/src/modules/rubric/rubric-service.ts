import type { PrismaClient } from "@prisma/client";
import { callAiGatewayJson, isAiGatewayError, type AiProviderAttempt } from "@ai-grading/ai-gateway";
import { normalizeNonEmpty } from "@ai-grading/domain-core";
import type { AiGatewayOverrides } from "@/modules/settings/ai-runtime-service";

export type RubricLifecycleStatus = "draft" | "published";

export class RubricDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "RubricDomainError";
  }
}

export const isRubricDomainError = (error: unknown): error is RubricDomainError => {
  return error instanceof RubricDomainError;
};

const normalizeLifecycleStatus = (value?: string | null): RubricLifecycleStatus => {
  return value === "published" ? "published" : "draft";
};

const parseRubricJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const inferQuestionKeyFromRubric = (rubric: unknown): string | undefined => {
  if (!rubric || typeof rubric !== "object") {
    return undefined;
  }

  const asObject = rubric as {
    metadata?: { questionId?: unknown };
    questionKey?: unknown;
    questionId?: unknown;
  };

  const fromMetadata = normalizeNonEmpty(
    typeof asObject.metadata?.questionId === "string" ? asObject.metadata.questionId : undefined
  );

  if (fromMetadata) {
    return fromMetadata;
  }

  const fromQuestionKey = normalizeNonEmpty(
    typeof asObject.questionKey === "string" ? asObject.questionKey : undefined
  );

  if (fromQuestionKey) {
    return fromQuestionKey;
  }

  return normalizeNonEmpty(
    typeof asObject.questionId === "string" ? asObject.questionId : undefined
  );
};

const computeRubricSummary = (rubric: unknown): {
  totalScore: number;
  pointCount: number;
  title: string;
  updatedAt: string;
} => {
  const nowIso = new Date().toISOString();

  if (!rubric || typeof rubric !== "object") {
    return {
      totalScore: 0,
      pointCount: 0,
      title: "未命名评分细则",
      updatedAt: nowIso
    };
  }

  const rubricObj = rubric as {
    metadata?: { title?: unknown; questionType?: unknown; subject?: unknown; totalScore?: unknown };
    answerPoints?: Array<{ score?: unknown }>;
    content?: { points?: Array<{ score?: unknown }> };
    segments?: Array<Record<string, unknown>>;
    segmentAggregation?: unknown;
    totalScore?: unknown;
    updatedAt?: unknown;
  };

  const segmentRows = Array.isArray(rubricObj.segments)
    ? rubricObj.segments
      .filter((segment): segment is Record<string, unknown> => Boolean(segment) && typeof segment === "object")
    : [];

  const segmentPointsCount = segmentRows.reduce((sum, segment) => {
    const content = toRecord(segment.content) ?? {};
    return sum
      + toRecordList(segment.points).length
      + toRecordList(content.points).length
      + toRecordList(content.steps).length
      + toRecordList(content.dimensions).length;
  }, 0);

  const segmentScore = segmentRows.reduce((sum, segment) => {
    const maxScore = Number(segment.maxScore);
    return Number.isFinite(maxScore) && maxScore > 0 ? sum + maxScore : sum;
  }, 0);

  const answerPoints = Array.isArray(rubricObj.answerPoints)
    ? rubricObj.answerPoints
    : Array.isArray(rubricObj.content?.points)
      ? rubricObj.content.points
      : [];

  const answerPointScore = answerPoints.reduce((sum, point) => {
    const score = Number(point?.score);
    return Number.isFinite(score) ? sum + score : sum;
  }, 0);

  const metadataScore = Number(rubricObj.metadata?.totalScore);
  const rootScore = Number(rubricObj.totalScore);
  const totalScore = Number.isFinite(metadataScore) && metadataScore > 0
    ? metadataScore
    : Number.isFinite(rootScore) && rootScore > 0
      ? rootScore
      : segmentScore > 0
        ? segmentScore
        : answerPointScore;

  const metadataTitle = normalizeNonEmpty(
    typeof rubricObj.metadata?.title === "string" ? rubricObj.metadata.title : undefined
  );
  const fallbackTitle = [rubricObj.metadata?.subject, rubricObj.metadata?.questionType]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(" ");

  const title = normalizeNonEmpty(
    metadataTitle ?? fallbackTitle
  ) ?? "未命名评分细则";

  const updatedAt = normalizeNonEmpty(
    typeof rubricObj.updatedAt === "string" ? rubricObj.updatedAt : undefined
  ) ?? nowIso;

  return {
    totalScore,
    pointCount: segmentPointsCount > 0 ? segmentPointsCount : answerPoints.length,
    title,
    updatedAt
  };
};

export const listRubrics = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    examId?: string;
  }
): Promise<Array<{
  questionId: string;
  title: string;
  totalScore: number;
  pointCount: number;
  updatedAt: string;
  examId: string | null;
  lifecycleStatus: RubricLifecycleStatus;
}>> => {
  const docs = await db.rubricDocument.findMany({
    where: {
      scopeKey: input.scopeKey,
      ...(input.examId ? { examId: input.examId } : {})
    },
    orderBy: { updatedAt: "desc" }
  });

  return docs.map((doc) => {
    const rubric = parseRubricJson(doc.rubricJson);
    const summary = computeRubricSummary(rubric);

    return {
      questionId: doc.questionKey,
      title: summary.title,
      totalScore: summary.totalScore,
      pointCount: summary.pointCount,
      updatedAt: summary.updatedAt,
      examId: doc.examId,
      lifecycleStatus: normalizeLifecycleStatus(doc.lifecycleStatus)
    };
  });
};

export const getRubricByQuestionKey = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    questionKey: string;
  }
): Promise<{
  rubric: unknown;
  lifecycleStatus: RubricLifecycleStatus;
} | null> => {
  const doc = await db.rubricDocument.findUnique({
    where: {
      scopeKey_questionKey: {
        scopeKey: input.scopeKey,
        questionKey: input.questionKey
      }
    }
  });

  if (!doc) {
    return null;
  }

  return {
    rubric: parseRubricJson(doc.rubricJson),
    lifecycleStatus: normalizeLifecycleStatus(doc.lifecycleStatus)
  };
};

export const upsertRubric = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    questionKey?: string;
    rubric: unknown;
    examId?: string | null;
    deviceId?: string;
    lifecycleStatus?: string;
  }
): Promise<{
  questionKey: string;
  rubric: unknown;
  examId: string | null;
  lifecycleStatus: RubricLifecycleStatus;
}> => {
  const questionKey =
    normalizeNonEmpty(input.questionKey) ?? inferQuestionKeyFromRubric(input.rubric);

  if (!questionKey) {
    throw new RubricDomainError("MISSING_QUESTION_KEY", "缺少 questionKey", 400);
  }

  const lifecycleStatus = normalizeLifecycleStatus(input.lifecycleStatus);

  const now = new Date().toISOString();
  const rubricPayload =
    input.rubric && typeof input.rubric === "object"
      ? {
          ...(input.rubric as Record<string, unknown>),
          updatedAt: now,
          createdAt:
            (input.rubric as { createdAt?: unknown }).createdAt ?? now
        }
      : {
          questionKey,
          updatedAt: now,
          createdAt: now,
          content: input.rubric
        };

  const doc = await db.rubricDocument.upsert({
    where: {
      scopeKey_questionKey: {
        scopeKey: input.scopeKey,
        questionKey
      }
    },
    update: {
      rubricJson: JSON.stringify(rubricPayload),
      examId: input.examId ?? null,
      deviceId: input.deviceId ?? null,
      lifecycleStatus
    },
    create: {
      scopeKey: input.scopeKey,
      questionKey,
      rubricJson: JSON.stringify(rubricPayload),
      examId: input.examId ?? null,
      deviceId: input.deviceId ?? null,
      lifecycleStatus
    }
  });

  return {
    questionKey: doc.questionKey,
    rubric: parseRubricJson(doc.rubricJson),
    examId: doc.examId,
    lifecycleStatus: normalizeLifecycleStatus(doc.lifecycleStatus)
  };
};

export const deleteRubric = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    questionKey: string;
  }
): Promise<void> => {
  await db.rubricDocument.deleteMany({
    where: {
      scopeKey: input.scopeKey,
      questionKey: input.questionKey
    }
  });
};

const extractKeywords = (answerText: string): string[] => {
  return Array.from(
    new Set(
      answerText
        .split(/[\n，。；、,.!?\s]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .slice(0, 12)
    )
  );
};

const buildAnswerPointsFromText = (answerText: string, totalScore = 10) => {
  const lines = answerText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [
      {
        id: "p1",
        content: "答案结构完整，史实准确",
        keywords: [],
        score: totalScore
      }
    ];
  }

  const perPointScore = Math.max(1, Math.floor(totalScore / lines.length));

  return lines.map((line, index) => ({
    id: `p${index + 1}`,
    content: line,
    keywords: extractKeywords(line),
    score: perPointScore
  }));
};

type NormalizedRubricPoint = {
  id: string;
  content: string;
  keywords: string[];
  score: number;
  questionSegment?: string;
  order?: number;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const firstNonEmptyText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = normalizeNonEmpty(typeof value === "string" ? value : undefined);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const toStrategyType = (value: unknown): "point_accumulation" | "sequential_logic" | "rubric_matrix" | null => {
  return value === "point_accumulation" || value === "sequential_logic" || value === "rubric_matrix"
    ? value
    : null;
};

const toScoringType = (value: unknown): "all" | "pick_n" | "weighted" => {
  return value === "pick_n" || value === "weighted" ? value : "all";
};

const toMatchMode = (value: unknown): "strict" | "keyword" | "semantic" => {
  return value === "strict" || value === "semantic" ? value : "keyword";
};

const toSegmentAggregation = (value: unknown): "sum" | "weighted_sum" | "max" => {
  return value === "weighted_sum" || value === "max" ? value : "sum";
};

const toQuestionTypeV4 = (value: unknown): "single" | "mixed" => {
  if (value === "single" || value === "mixed") {
    return value;
  }

  const text = normalizeNonEmpty(typeof value === "string" ? value : undefined);
  if (!text) {
    return "mixed";
  }

  if (
    text.includes("选择")
    || text.includes("单选")
    || text.includes("多选")
    || text.includes("判断")
    || text.includes("填空")
  ) {
    return "single";
  }

  return "mixed";
};

const normalizePoint = (row: Record<string, unknown>, index: number): NormalizedRubricPoint | null => {
  const content = firstNonEmptyText(row.content, row.standard, row.label, row.name, row.description);
  if (!content) {
    return null;
  }

  const score = Number(row.score);
  const order = Number(row.order);
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : extractKeywords(content);

  return {
    id: firstNonEmptyText(row.id) ?? `p${index + 1}`,
    content,
    keywords,
    score: Number.isFinite(score) && score > 0 ? score : 1,
    questionSegment: firstNonEmptyText(row.questionSegment) ?? undefined,
    order: Number.isFinite(order) && order > 0 ? Math.floor(order) : undefined
  };
};

const normalizePointsFromUnknown = (value: unknown): NormalizedRubricPoint[] => {
  return toRecordList(value)
    .map((row, index) => normalizePoint(row, index))
    .filter((item): item is NormalizedRubricPoint => Boolean(item));
};

const normalizePointsFromRoot = (
  root: Record<string, unknown>,
  fallbackAnswerText: string,
  fallbackTotalScore: number
): NormalizedRubricPoint[] => {
  const content = toRecord(root.content) ?? {};
  const points = [
    ...normalizePointsFromUnknown(root.answerPoints),
    ...normalizePointsFromUnknown(root.points),
    ...normalizePointsFromUnknown(content.points),
    ...normalizePointsFromUnknown(content.steps)
  ];

  if (points.length > 0) {
    return points;
  }

  return buildAnswerPointsFromText(fallbackAnswerText, fallbackTotalScore);
};

const sumPointsScore = (points: NormalizedRubricPoint[]): number => {
  return points.reduce((sum, point) => sum + point.score, 0);
};

const normalizeConstraintType = (value: unknown): "deduction_fixed" | "deduction_per_count" | "score_cap" | "logic_check" | null => {
  return value === "deduction_fixed"
    || value === "deduction_per_count"
    || value === "score_cap"
    || value === "logic_check"
    ? value
    : null;
};

const normalizeConstraintFromRule = (
  rule: string,
  index: number
): { id: string; type: "deduction_fixed" | "deduction_per_count" | "score_cap" | "logic_check"; config: Record<string, unknown> } => {
  const compact = rule.replace(/\s+/g, "");
  const scoreCapMatch = compact.match(/(?:上限|封顶)(\d+(?:\.\d+)?)/);
  if (scoreCapMatch) {
    return {
      id: `constraint-custom-${index + 1}`,
      type: "score_cap",
      config: {
        description: rule,
        maxScore: Number(scoreCapMatch[1])
      }
    };
  }

  const perCountMatch = compact.match(/每(\d+).{0,10}?扣(\d+(?:\.\d+)?)分?/);
  if (perCountMatch) {
    return {
      id: `constraint-custom-${index + 1}`,
      type: "deduction_per_count",
      config: {
        description: rule,
        every: Number(perCountMatch[1]),
        deduction: Number(perCountMatch[2])
      }
    };
  }

  const fixedMatch = compact.match(/扣(\d+(?:\.\d+)?)分?/);
  if (fixedMatch) {
    return {
      id: `constraint-custom-${index + 1}`,
      type: "deduction_fixed",
      config: {
        description: rule,
        deduction: Number(fixedMatch[1])
      }
    };
  }

  return {
    id: `constraint-custom-${index + 1}`,
    type: "logic_check",
    config: {
      description: rule
    }
  };
};

const normalizeConstraints = (
  root: Record<string, unknown>,
  customRules?: string[]
): Array<{ id: string; type: "deduction_fixed" | "deduction_per_count" | "score_cap" | "logic_check"; config: Record<string, unknown> }> => {
  const fromRoot = toRecordList(root.constraints)
    .map((row, index) => {
      const type = normalizeConstraintType(row.type);
      if (!type) {
        return null;
      }

      return {
        id: firstNonEmptyText(row.id) ?? `constraint-${index + 1}`,
        type,
        config: toRecord(row.config) ?? {}
      };
    })
    .filter((item): item is { id: string; type: "deduction_fixed" | "deduction_per_count" | "score_cap" | "logic_check"; config: Record<string, unknown> } => Boolean(item));

  const fromRules = (customRules ?? [])
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule, index) => normalizeConstraintFromRule(rule, index));

  const merged = [...fromRoot];
  fromRules.forEach((constraint) => {
    const duplicate = merged.some((item) => {
      const left = firstNonEmptyText(item.config.description) ?? "";
      const right = firstNonEmptyText(constraint.config.description) ?? "";
      return item.type === constraint.type && left === right;
    });
    if (!duplicate) {
      merged.push(constraint);
    }
  });

  return merged;
};

const normalizeGlobalPolicy = (root: Record<string, unknown>): {
  conflictPolicy: "checkpoints_first" | "segments_first";
  minConfidence: number;
  ocrTolerance: "low" | "medium" | "high";
} => {
  const policy = toRecord(root.globalPolicy) ?? {};
  const minConfidence = Number(policy.minConfidence);

  return {
    conflictPolicy: policy.conflictPolicy === "checkpoints_first" ? "checkpoints_first" : "segments_first",
    minConfidence: Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1 ? minConfidence : 0.6,
    ocrTolerance: policy.ocrTolerance === "low" || policy.ocrTolerance === "high" ? policy.ocrTolerance : "medium"
  };
};

const normalizeSegments = (input: {
  root: Record<string, unknown>;
  fallbackPoints: NormalizedRubricPoint[];
  fallbackQuestionTypeText?: string;
}): Array<Record<string, unknown>> => {
  const rootSegments = toRecordList(input.root.segments);

  if (rootSegments.length === 0) {
    const totalScore = Math.max(1, sumPointsScore(input.fallbackPoints));
    return [
      {
        id: "segment-1",
        title: "默认题段",
        questionType: input.fallbackQuestionTypeText ?? "综合题",
        strategyType: "point_accumulation",
        maxScore: totalScore,
        matching: {
          mode: "keyword"
        },
        scoring: {
          type: "all"
        },
        content: {
          scoringStrategy: {
            type: "all"
          },
          points: input.fallbackPoints,
          totalScore
        }
      }
    ];
  }

  return rootSegments.map((segment, index) => {
    const content = toRecord(segment.content) ?? {};
    const rawStrategy = toStrategyType(segment.strategyType);
    const strategyType = rawStrategy ?? "point_accumulation";
    const points = [
      ...normalizePointsFromUnknown(segment.points),
      ...normalizePointsFromUnknown(content.points),
      ...normalizePointsFromUnknown(content.steps)
    ];

    const normalizedPoints = points.length > 0 ? points : (index === 0 ? input.fallbackPoints : []);
    const fallbackScore = normalizedPoints.length > 0 ? sumPointsScore(normalizedPoints) : 1;
    const maxScoreRaw = Number(segment.maxScore);
    const maxScore = Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : Math.max(1, fallbackScore);

    const matching = toRecord(segment.matching) ?? {};
    const scoring = toRecord(segment.scoring) ?? {};
    const segmentConstraints = normalizeConstraints(segment);

    if (strategyType === "rubric_matrix") {
      const rawDimensions = toRecordList(content.dimensions);
      const dimensions = rawDimensions
        .map((dimension, dimensionIndex) => {
          const levels = toRecordList(dimension.levels)
            .map((level, levelIndex) => {
              const label = firstNonEmptyText(level.label) ?? `等级${levelIndex + 1}`;
              const score = Number(level.score);
              return {
                label,
                score: Number.isFinite(score) && score >= 0 ? score : 0,
                description: firstNonEmptyText(level.description) ?? undefined
              };
            })
            .filter((level) => level.label.length > 0);

          if (levels.length === 0) {
            return null;
          }

          const weight = Number(dimension.weight);

          return {
            id: firstNonEmptyText(dimension.id) ?? `dimension-${index + 1}-${dimensionIndex + 1}`,
            name: firstNonEmptyText(dimension.name) ?? `维度${dimensionIndex + 1}`,
            weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
            levels
          };
        })
        .filter((item): item is { id: string; name: string; weight: number; levels: Array<{ label: string; score: number; description: string | undefined }> } => Boolean(item));

      if (dimensions.length > 0) {
        const matrixScore = dimensions.reduce((sum, dimension) => {
          const levelMax = dimension.levels.reduce((max, level) => Math.max(max, level.score), 0);
          return sum + (levelMax * dimension.weight);
        }, 0);

        const matrixMaxScore = Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : Math.max(1, matrixScore);

        return {
          id: firstNonEmptyText(segment.id) ?? `segment-${index + 1}`,
          title: firstNonEmptyText(segment.title, segment.name, segment.segment) ?? `第${index + 1}段`,
          questionType: firstNonEmptyText(segment.questionType, input.fallbackQuestionTypeText) ?? "综合题",
          strategyType: "rubric_matrix",
          maxScore: matrixMaxScore,
          matching: {
            mode: toMatchMode(matching.mode)
          },
          scoring: {
            type: toScoringType(scoring.type)
          },
          constraints: segmentConstraints.length > 0 ? segmentConstraints : undefined,
          content: {
            dimensions,
            totalScore: matrixMaxScore
          }
        };
      }
    }

    if (strategyType === "sequential_logic") {
      const steps = normalizedPoints.map((point, pointIndex) => ({
        id: point.id,
        content: point.content,
        keywords: point.keywords,
        score: point.score,
        order: point.order ?? (pointIndex + 1)
      }));

      return {
        id: firstNonEmptyText(segment.id) ?? `segment-${index + 1}`,
        title: firstNonEmptyText(segment.title, segment.name, segment.segment) ?? `第${index + 1}段`,
        questionType: firstNonEmptyText(segment.questionType, input.fallbackQuestionTypeText) ?? "综合题",
        strategyType: "sequential_logic",
        maxScore,
        matching: {
          mode: toMatchMode(matching.mode)
        },
        scoring: {
          type: toScoringType(scoring.type)
        },
        constraints: segmentConstraints.length > 0 ? segmentConstraints : undefined,
        content: {
          scoringStrategy: {
            type: toScoringType(toRecord(content.scoringStrategy)?.type ?? scoring.type)
          },
          steps,
          totalScore: maxScore
        }
      };
    }

    return {
      id: firstNonEmptyText(segment.id) ?? `segment-${index + 1}`,
      title: firstNonEmptyText(segment.title, segment.name, segment.segment) ?? `第${index + 1}段`,
      questionType: firstNonEmptyText(segment.questionType, input.fallbackQuestionTypeText) ?? "综合题",
      strategyType: "point_accumulation",
      maxScore,
      matching: {
        mode: toMatchMode(matching.mode)
      },
      scoring: {
        type: toScoringType(scoring.type)
      },
      constraints: segmentConstraints.length > 0 ? segmentConstraints : undefined,
      content: {
        scoringStrategy: {
          type: toScoringType(toRecord(content.scoringStrategy)?.type ?? scoring.type)
        },
        points: normalizedPoints,
        totalScore: maxScore
      }
    };
  });
};

const buildRuleBasedRubric = (input: {
  questionId?: string;
  subject?: string;
  questionType?: string;
  strategyType?: string;
  answerText?: string;
  totalScore?: number;
  customRules?: string[];
}): Record<string, unknown> => {
  const totalScore = Math.max(1, Math.floor(input.totalScore ?? 10));
  const answerPoints = buildAnswerPointsFromText(input.answerText ?? "", totalScore);
  const questionId = normalizeNonEmpty(input.questionId) ?? `q-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    version: "4.0",
    metadata: {
      questionId,
      subject: input.subject ?? "history",
      questionType: toQuestionTypeV4(input.questionType),
      totalScore
    },
    globalPolicy: {
      conflictPolicy: "segments_first",
      minConfidence: 0.6,
      ocrTolerance: "medium"
    },
    segmentAggregation: "sum",
    segments: [
      {
        id: "segment-1",
        title: "默认题段",
        questionType: input.questionType ?? "综合题",
        strategyType: toStrategyType(input.strategyType) ?? "point_accumulation",
        maxScore: totalScore,
        matching: {
          mode: "keyword"
        },
        scoring: {
          type: "all"
        },
        content: {
          scoringStrategy: {
            type: "all"
          },
          points: answerPoints,
          totalScore
        }
      }
    ],
    constraints: normalizeConstraints({}, input.customRules),
    createdAt: now,
    updatedAt: now
  };
};

const normalizeAiRubricResult = (
  candidate: Record<string, unknown>,
  input: {
    questionId?: string;
    subject?: string;
    questionType?: string;
    strategyType?: string;
    answerText?: string;
    totalScore?: number;
    customRules?: string[];
  }
): Record<string, unknown> => {
  const now = new Date().toISOString();
  const root = (
    typeof candidate.rubric === "object" &&
    candidate.rubric &&
    !Array.isArray(candidate.rubric)
      ? candidate.rubric
      : candidate
  ) as Record<string, unknown>;

  const metadata = (
    typeof root.metadata === "object" && root.metadata && !Array.isArray(root.metadata)
      ? root.metadata
      : {}
  ) as Record<string, unknown>;

  const questionId = firstNonEmptyText(metadata.questionId, root.questionId, input.questionId) ?? `q-${Date.now()}`;
  const fallbackTotalScore = Math.max(1, Math.floor(input.totalScore ?? 10));
  const fallbackPoints = normalizePointsFromRoot(root, input.answerText ?? "", fallbackTotalScore);
  const segments = normalizeSegments({
    root,
    fallbackPoints,
    fallbackQuestionTypeText: input.questionType
  });

  const metadataTotalScore = Number(metadata.totalScore);
  const rootTotalScore = Number(root.totalScore);
  const segmentsTotal = segments.reduce((sum, segment) => {
    const score = Number(segment.maxScore);
    return Number.isFinite(score) && score > 0 ? sum + score : sum;
  }, 0);

  const totalScore = Number.isFinite(metadataTotalScore) && metadataTotalScore > 0
    ? metadataTotalScore
    : Number.isFinite(rootTotalScore) && rootTotalScore > 0
      ? rootTotalScore
      : segmentsTotal > 0
        ? segmentsTotal
        : fallbackTotalScore;

  return {
    version: "4.0",
    metadata: {
      subject: firstNonEmptyText(metadata.subject, input.subject) ?? "history",
      grade: firstNonEmptyText(metadata.grade) ?? undefined,
      examName: firstNonEmptyText(metadata.examName) ?? undefined,
      questionId,
      questionType: toQuestionTypeV4(firstNonEmptyText(metadata.questionType, input.questionType)),
      totalScore,
      tags: Array.isArray(metadata.tags)
        ? metadata.tags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : undefined
    },
    globalPolicy: normalizeGlobalPolicy(root),
    segmentAggregation: toSegmentAggregation(root.segmentAggregation),
    segments,
    constraints: normalizeConstraints(root, input.customRules),
    createdAt: firstNonEmptyText(root.createdAt, metadata.createdAt) ?? now,
    updatedAt: now
  };
};

export type AiProviderTrace = {
  mode: "ai" | "fallback";
  reason?: string;
  attempts?: AiProviderAttempt[];
};

type StandardizedRubricRow = {
  score: number;
  standard: string;
  deduction: string;
};

const stripMarkdownCodeFence = (value: string): string => {
  return value
    .replace(/```markdown\s*/gi, "")
    .replace(/```md\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
};

const toSafeText = (value: string): string => {
  return value.replace(/\|/g, "\\|").trim();
};

const formatScoreLabel = (value: number): string => {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
};

const extractRowsFromRubricObject = (rubric: Record<string, unknown>): StandardizedRubricRow[] => {
  const rootPoints = Array.isArray(rubric.answerPoints)
    ? rubric.answerPoints
    : Array.isArray((rubric as { content?: { points?: unknown[] } }).content?.points)
      ? (rubric as { content: { points: unknown[] } }).content.points
      : [];

  const segmentPoints = Array.isArray(rubric.segments)
    ? rubric.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") {
        return [];
      }

      const row = segment as { points?: unknown[]; content?: { points?: unknown[]; steps?: unknown[]; dimensions?: unknown[] } };
      const contentPoints = Array.isArray(row.content?.points) ? row.content.points : [];
      const contentSteps = Array.isArray(row.content?.steps) ? row.content.steps : [];
      const matrixRows = Array.isArray(row.content?.dimensions)
        ? row.content.dimensions.flatMap((dimension) => {
          if (!dimension || typeof dimension !== "object") {
            return [];
          }
          const dim = dimension as { name?: unknown; levels?: unknown[] };
          const levels = Array.isArray(dim.levels) ? dim.levels : [];
          return levels.map((level) => {
            if (!level || typeof level !== "object") {
              return null;
            }
            const levelRow = level as { label?: unknown; score?: unknown; description?: unknown };
            return {
              content: `${normalizeNonEmpty(typeof dim.name === "string" ? dim.name : undefined) ?? "维度"}-${normalizeNonEmpty(typeof levelRow.label === "string" ? levelRow.label : undefined) ?? "等级"}`,
              score: levelRow.score,
              deductionRules: levelRow.description
            };
          }).filter(Boolean);
        })
        : [];
      return [...(Array.isArray(row.points) ? row.points : []), ...contentPoints, ...contentSteps, ...matrixRows];
    })
    : [];

  const sourcePoints = segmentPoints.length > 0 ? segmentPoints : rootPoints;

  const rows = sourcePoints
    .map((item, index): StandardizedRubricRow | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const point = item as {
        content?: unknown;
        score?: unknown;
        deductionRules?: unknown;
      };

      const standard = normalizeNonEmpty(typeof point.content === "string" ? point.content : undefined);
      if (!standard) {
        return null;
      }

      const parsedScore = Number(point.score);
      const score = Number.isFinite(parsedScore) && parsedScore > 0 ? parsedScore : 1;

      return {
        score,
        standard,
        deduction:
          normalizeNonEmpty(
            typeof point.deductionRules === "string" ? point.deductionRules : undefined
          ) ?? `未命中要点可酌情扣分（第${index + 1}点）`
      };
    })
    .filter((item): item is StandardizedRubricRow => Boolean(item));

  return rows;
};

const extractRowsFromRubricText = (rubric: string): StandardizedRubricRow[] => {
  const rows = rubric
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index): StandardizedRubricRow | null => {
      const scoreMatch = line.match(/([0-9]+(?:\.[0-9]+)?)\s*分/);
      const score = scoreMatch ? Number(scoreMatch[1]) : Number.NaN;

      const standard = normalizeNonEmpty(
        line
          .replace(/^[\-*•\d\.\)\(、\s]+/, "")
          .replace(/（?\s*[0-9]+(?:\.[0-9]+)?\s*分\s*）?/g, "")
          .replace(/\(\s*[0-9]+(?:\.[0-9]+)?\s*分\s*\)/g, "")
          .trim()
      );

      if (!standard) {
        return null;
      }

      return {
        score: Number.isFinite(score) && score > 0 ? score : 0,
        standard,
        deduction: `未命中“${standard.slice(0, 12)}”可酌情扣分`
      };
    })
    .filter((item): item is StandardizedRubricRow => Boolean(item));

  return rows;
};

const distributeMissingScores = (
  rows: StandardizedRubricRow[],
  totalScore: number
): StandardizedRubricRow[] => {
  const provided = rows.filter((item) => item.score > 0);
  const missing = rows.filter((item) => item.score <= 0);

  if (missing.length === 0) {
    return rows;
  }

  const providedSum = provided.reduce((sum, item) => sum + item.score, 0);
  const remaining = Math.max(0, totalScore - providedSum);
  const average = remaining > 0 ? remaining / missing.length : totalScore / rows.length;
  const roundedAverage = Number(average.toFixed(1));

  return rows.map((item) => {
    if (item.score > 0) {
      return item;
    }

    return {
      ...item,
      score: roundedAverage > 0 ? roundedAverage : 1
    };
  });
};

const buildFallbackStandardizedRubric = (
  rubricInput: string | Record<string, unknown>,
  maxScore?: number
): string => {
  const rawRows =
    typeof rubricInput === "string"
      ? extractRowsFromRubricText(rubricInput)
      : extractRowsFromRubricObject(rubricInput);

  const rows = rawRows.length
    ? rawRows
    : [
        {
          score: maxScore && maxScore > 0 ? maxScore : 10,
          standard: "答案结构完整，史实准确，论证逻辑清晰",
          deduction: "缺失关键史实或逻辑链不完整可酌情扣分"
        }
      ];

  const explicitTotal = rows.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  const resolvedTotal = Math.max(
    1,
    Math.round(
      maxScore && maxScore > 0
        ? Math.max(maxScore, explicitTotal)
        : explicitTotal > 0
          ? explicitTotal
          : 10
    )
  );
  const normalizedRows = distributeMissingScores(rows, resolvedTotal);

  const markdownRows = normalizedRows
    .map(
      (item) =>
        `| ${formatScoreLabel(item.score)} | ${toSafeText(item.standard)} | ${toSafeText(item.deduction)} |`
    )
    .join("\n");

  return [
    `## 总分: ${formatScoreLabel(resolvedTotal)}分`,
    "",
    "| 分值 | 给分标准 | 常见错误及扣分 |",
    "| --- | --- | --- |",
    markdownRows
  ].join("\n");
};

const extractStandardizedRubric = (candidate: Record<string, unknown>): string | null => {
  const possibleKeys = ["rubric", "rubricMarkdown", "markdown", "content"] as const;

  for (const key of possibleKeys) {
    const value = candidate[key];
    const text = normalizeNonEmpty(typeof value === "string" ? value : undefined);
    if (text) {
      return stripMarkdownCodeFence(text);
    }
  }

  return null;
};

export const standardizeRubric = async (input: {
  rubric: string | Record<string, unknown>;
  maxScore?: number;
  gatewayOverrides?: AiGatewayOverrides;
}): Promise<{
  rubric: string;
  provider: string;
  providerTrace: AiProviderTrace;
}> => {
  const sourceText =
    typeof input.rubric === "string" ? input.rubric : JSON.stringify(input.rubric, null, 2);

  const userPrompt = [
    "请将以下评分细则整理为标准 Markdown 格式。",
    "输出要求：",
    "1) 首行为 ## 总分: X分",
    "2) 必须包含三列表格：分值 | 给分标准 | 常见错误及扣分",
    "3) 保留原始要点，不要遗漏",
    "4) 禁止输出代码块标记",
    input.maxScore ? `5) 总分以 ${input.maxScore} 分为准` : "5) 若原文无总分，请合理推断总分",
    "",
    "原始评分细则：",
    sourceText
  ].join("\n");

  try {
    const aiResult = await callAiGatewayJson({
      task: "rubric_generate",
      systemPrompt: "你是一名评分细则格式化专家，请输出 JSON 对象。",
      userPrompt,
      preferredProviders: input.gatewayOverrides?.preferredProviders,
      runtime: input.gatewayOverrides?.runtime,
      temperature: 0.1,
      maxTokens: 2048
    });

    const standardizedRubric = extractStandardizedRubric(aiResult.json);
    if (!standardizedRubric) {
      throw new Error("AI_STANDARDIZE_EMPTY_RESULT");
    }

    return {
      rubric: standardizedRubric,
      provider: `${aiResult.provider}:${aiResult.model}`,
      providerTrace: {
        mode: "ai"
      }
    };
  } catch (error) {
    const trace: AiProviderTrace =
      isAiGatewayError(error)
        ? {
            mode: "fallback",
            reason: error.code,
            attempts: error.attempts
          }
        : {
            mode: "fallback",
            reason: error instanceof Error ? error.message : "AI_STANDARDIZE_UNKNOWN_ERROR"
          };

    return {
      rubric: buildFallbackStandardizedRubric(input.rubric, input.maxScore),
      provider: "rule-standardizer",
      providerTrace: trace
    };
  }
};

export const generateRubricDraft = async (input: {
  questionId?: string;
  subject?: string;
  questionType?: string;
  strategyType?: string;
  answerText?: string;
  totalScore?: number;
  questionImage?: string;
  answerImage?: string;
  customRules?: string[];
  gatewayOverrides?: AiGatewayOverrides;
}): Promise<{
  rubric: Record<string, unknown>;
  provider: string;
  providerTrace: AiProviderTrace;
}> => {
  const ruleBasedRubric = buildRuleBasedRubric(input);
  const images = [
    input.questionImage
      ? {
          base64: input.questionImage,
          label: "【试题图片】"
        }
      : null,
    input.answerImage
      ? {
          base64: input.answerImage,
          label: "【参考答案图片】"
        }
      : null
  ].filter((item): item is { base64: string; label: string } => Boolean(item));

  const systemPrompt = [
    "你是一名高中历史学科阅卷专家。",
    "请输出 RubricV4 JSON。",
    "输出必须是 JSON 对象，禁止输出 markdown。",
    "字段至少包含：version, metadata, globalPolicy, segments, segmentAggregation。",
    "version 必须是 4.0。",
    "segments 至少包含 1 个 segment，且每个 segment 必须包含 strategyType、maxScore、matching、scoring、content。"
  ].join("\n");

  const userPrompt = [
    `题目ID: ${input.questionId ?? "未提供"}`,
    `学科: ${input.subject ?? "history"}`,
    `题型: ${input.questionType ?? "analysis"}`,
    `评分策略: ${input.strategyType ?? "standard"}`,
    `总分: ${Math.max(1, Math.floor(input.totalScore ?? 10))}`,
    input.customRules && input.customRules.length > 0
      ? `特殊规则:\n${input.customRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}`
      : "特殊规则: 无",
    input.answerText ? `参考答案文本:\n${input.answerText}` : "参考答案文本: 未提供"
  ].join("\n");

  try {
    const aiResult = await callAiGatewayJson({
      task: "rubric_generate",
      systemPrompt,
      userPrompt,
      images,
      preferredProviders: input.gatewayOverrides?.preferredProviders,
      runtime: input.gatewayOverrides?.runtime,
      temperature: 0.2,
      maxTokens: 2048
    });

    const normalizedRubric = normalizeAiRubricResult(aiResult.json, input);

    return {
      provider: `${aiResult.provider}:${aiResult.model}`,
      rubric: normalizedRubric,
      providerTrace: {
        mode: "ai"
      }
    };
  } catch (error) {
    const trace =
      isAiGatewayError(error)
        ? {
            mode: "fallback" as const,
            reason: error.code,
            attempts: error.attempts
          }
        : {
            mode: "fallback" as const,
            reason: "AI_GATEWAY_UNKNOWN_ERROR"
          };

    return {
      provider: "rule-based-generator",
      rubric: ruleBasedRubric,
      providerTrace: trace
    };
  }
};
