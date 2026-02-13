import type { PrismaClient } from "@prisma/client";
import { callAiGatewayJson, isAiGatewayError, type AiProviderAttempt } from "@ai-grading/ai-gateway";
import { normalizeNonEmpty } from "@ai-grading/domain-core";

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
    metadata?: { title?: unknown; questionType?: unknown };
    answerPoints?: Array<{ score?: unknown }>;
    content?: { points?: Array<{ score?: unknown }> };
    updatedAt?: unknown;
  };

  const answerPoints = Array.isArray(rubricObj.answerPoints)
    ? rubricObj.answerPoints
    : Array.isArray(rubricObj.content?.points)
      ? rubricObj.content.points
      : [];

  const totalScore = answerPoints.reduce((sum, point) => {
    const score = Number(point?.score);
    return Number.isFinite(score) ? sum + score : sum;
  }, 0);

  const title = normalizeNonEmpty(
    typeof rubricObj.metadata?.title === "string" ? rubricObj.metadata.title : undefined
  ) ?? "未命名评分细则";

  const updatedAt = normalizeNonEmpty(
    typeof rubricObj.updatedAt === "string" ? rubricObj.updatedAt : undefined
  ) ?? nowIso;

  return {
    totalScore,
    pointCount: answerPoints.length,
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

const buildRuleBasedRubric = (input: {
  questionId?: string;
  subject?: string;
  questionType?: string;
  strategyType?: string;
  answerText?: string;
  totalScore?: number;
}): Record<string, unknown> => {
  const totalScore = Math.max(1, Math.floor(input.totalScore ?? 10));
  const answerPoints = buildAnswerPointsFromText(input.answerText ?? "", totalScore);
  const now = new Date().toISOString();

  return {
    version: "2.0",
    scoringStrategy: "all",
    answerPoints,
    gradingNotes: "按要点命中情况进行评分，可结合表达完整性酌情给分。",
    metadata: {
      questionId: input.questionId ?? `q-${Date.now()}`,
      title: `自动生成细则-${input.questionId ?? "未命名题目"}`,
      subject: input.subject ?? "history",
      questionType: input.questionType ?? "analysis",
      strategyType: input.strategyType ?? "standard"
    },
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

  const questionId =
    normalizeNonEmpty(
      typeof metadata.questionId === "string" ? metadata.questionId : undefined
    ) ??
    normalizeNonEmpty(input.questionId) ??
    `q-${Date.now()}`;

  const title =
    normalizeNonEmpty(
      typeof metadata.title === "string" ? metadata.title : undefined
    ) ?? `自动生成细则-${questionId}`;

  const rawAnswerPoints = Array.isArray(root.answerPoints) ? root.answerPoints : [];

  const normalizedAnswerPoints = rawAnswerPoints
    .map((point, index) => {
      if (!point || typeof point !== "object") {
        return null;
      }

      const raw = point as {
        id?: unknown;
        content?: unknown;
        keywords?: unknown;
        score?: unknown;
      };

      const content = normalizeNonEmpty(
        typeof raw.content === "string" ? raw.content : undefined
      );

      if (!content) {
        return null;
      }

      const score = Number(raw.score);

      return {
        id: normalizeNonEmpty(typeof raw.id === "string" ? raw.id : undefined) ?? `p${index + 1}`,
        content,
        keywords: Array.isArray(raw.keywords)
          ? raw.keywords.filter((item): item is string => typeof item === "string")
          : extractKeywords(content),
        score: Number.isFinite(score) && score > 0 ? score : 1
      };
    })
    .filter((item): item is { id: string; content: string; keywords: string[]; score: number } => Boolean(item));

  const answerPoints =
    normalizedAnswerPoints.length > 0
      ? normalizedAnswerPoints
      : buildAnswerPointsFromText(input.answerText ?? "", Math.max(1, Math.floor(input.totalScore ?? 10)));

  return {
    ...root,
    version: "2.0",
    scoringStrategy:
      normalizeNonEmpty(typeof root.scoringStrategy === "string" ? root.scoringStrategy : undefined) ??
      "all",
    answerPoints,
    gradingNotes:
      normalizeNonEmpty(typeof root.gradingNotes === "string" ? root.gradingNotes : undefined) ??
      "按要点命中情况进行评分，可结合表达完整性酌情给分。",
    metadata: {
      ...metadata,
      questionId,
      title,
      subject:
        normalizeNonEmpty(typeof metadata.subject === "string" ? metadata.subject : undefined) ??
        input.subject ??
        "history",
      questionType:
        normalizeNonEmpty(typeof metadata.questionType === "string" ? metadata.questionType : undefined) ??
        input.questionType ??
        "analysis",
      strategyType:
        normalizeNonEmpty(typeof metadata.strategyType === "string" ? metadata.strategyType : undefined) ??
        input.strategyType ??
        "standard"
    },
    createdAt:
      normalizeNonEmpty(typeof root.createdAt === "string" ? root.createdAt : undefined) ?? now,
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

  const rows = rootPoints
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
    "请输出 RubricJSON v2。",
    "输出必须是 JSON 对象，禁止输出 markdown。",
    "字段至少包含：version, scoringStrategy, answerPoints, gradingNotes, metadata。"
  ].join("\n");

  const userPrompt = [
    `题目ID: ${input.questionId ?? "未提供"}`,
    `学科: ${input.subject ?? "history"}`,
    `题型: ${input.questionType ?? "analysis"}`,
    `评分策略: ${input.strategyType ?? "standard"}`,
    `总分: ${Math.max(1, Math.floor(input.totalScore ?? 10))}`,
    input.answerText ? `参考答案文本:\n${input.answerText}` : "参考答案文本: 未提供"
  ].join("\n");

  try {
    const aiResult = await callAiGatewayJson({
      task: "rubric_generate",
      systemPrompt,
      userPrompt,
      images,
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
