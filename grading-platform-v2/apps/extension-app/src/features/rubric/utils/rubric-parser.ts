import type {
  ConstraintType,
  ConstraintV4,
  GlobalPolicyV4,
  MatchMode,
  OcrTolerance,
  SegmentAggregation,
  StrategyType
} from "@ai-grading/domain-core";
import type {
  RubricMatrixDimensionPreview,
  RubricMatrixLevelPreview,
  RubricResultPoint,
  RubricResultPreview,
  SegmentPreview
} from "../types";

export const strategyLabelMap: Record<string, string> = {
  point_accumulation: "按点给分",
  sequential_logic: "按步给分",
  rubric_matrix: "等级矩阵",
  standard: "标准模式",
  all: "全点命中",
  weighted: "按权重累计",
  pick_n: "任答N点"
};

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

export const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

export const parseRubricInput = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请先输入 Rubric JSON 或文本内容");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

export const toPrettyString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const parseScore = (raw: string): number | undefined => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.round(parsed);
};

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
};

export const extractQuestionKey = (rubric: unknown): string | undefined => {
  const root = toRecord(rubric);
  if (!root) {
    return undefined;
  }

  const metadata = toRecord(root.metadata) ?? {};
  const metadataKey = firstText(metadata.questionId);
  if (metadataKey) {
    return metadataKey;
  }

  const questionKey = firstText(root.questionKey);
  if (questionKey) {
    return questionKey;
  }

  const questionId = firstText(root.questionId);
  return questionId || undefined;
};

const toStrategyType = (value: unknown): StrategyType => {
  return value === "sequential_logic" || value === "rubric_matrix"
    ? value
    : "point_accumulation";
};

const toAggregation = (value: unknown): SegmentAggregation => {
  return value === "weighted_sum" || value === "max"
    ? value
    : "sum";
};

const toMatchMode = (value: unknown): MatchMode | undefined => {
  return value === "strict" || value === "keyword" || value === "semantic"
    ? value
    : undefined;
};

const toConstraintType = (value: unknown): ConstraintType | null => {
  return value === "deduction_fixed"
    || value === "deduction_per_count"
    || value === "score_cap"
    || value === "logic_check"
    ? value
    : null;
};

const toOcrTolerance = (value: unknown): OcrTolerance => {
  return value === "low" || value === "high" ? value : "medium";
};

const normalizePoint = (
  point: Record<string, unknown>,
  index: number,
  segmentLabel?: string
): RubricResultPoint | null => {
  const content = firstText(point.content, point.standard, point.name, point.description);
  if (!content) {
    return null;
  }

  const scoreValue = Number(point.score);
  const score = Number.isFinite(scoreValue) ? scoreValue : 0;

  const keywords = Array.isArray(point.keywords)
    ? point.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id: firstText(point.id) || `p-${index + 1}`,
    questionSegment: firstText(point.questionSegment, segmentLabel) || "得分点",
    content,
    score,
    keywords
  };
};

const extractSegmentPoints = (segment: Record<string, unknown>, title: string): RubricResultPoint[] => {
  const content = toRecord(segment.content) ?? {};
  const rawPoints = [
    ...toRecordList(segment.points),
    ...toRecordList(content.points),
    ...toRecordList(content.steps)
  ];

  return rawPoints
    .map((point, index) => normalizePoint(point, index, title))
    .filter((item): item is RubricResultPoint => Boolean(item));
};

const normalizeMatrixLevels = (value: unknown): RubricMatrixLevelPreview[] => {
  return toRecordList(value).map((level, index) => {
    const score = Number(level.score);
    return {
      label: firstText(level.label) || `等级${index + 1}`,
      score: Number.isFinite(score) ? score : 0,
      description: firstText(level.description)
    };
  });
};

const normalizeMatrixDimensions = (segment: Record<string, unknown>): RubricMatrixDimensionPreview[] => {
  const content = toRecord(segment.content) ?? {};
  return toRecordList(content.dimensions).map((dimension, index) => {
    const weight = Number(dimension.weight);
    return {
      id: firstText(dimension.id) || `dimension-${index + 1}`,
      name: firstText(dimension.name) || `维度${index + 1}`,
      weight: Number.isFinite(weight) ? weight : 1,
      levels: normalizeMatrixLevels(dimension.levels)
    };
  });
};

const normalizeConstraints = (value: unknown): ConstraintV4[] => {
  const rows = toRecordList(value);
  return rows
    .map((row, index) => {
      const type = toConstraintType(row.type);
      if (!type) {
        return null;
      }

      return {
        id: firstText(row.id) || `constraint-${index + 1}`,
        type,
        config: toRecord(row.config) ?? {}
      } satisfies ConstraintV4;
    })
    .filter((item): item is ConstraintV4 => Boolean(item));
};

const normalizeGlobalPolicy = (value: unknown): GlobalPolicyV4 | null => {
  const policy = toRecord(value);
  if (!policy) {
    return null;
  }

  const minConfidence = Number(policy.minConfidence);

  return {
    conflictPolicy: policy.conflictPolicy === "checkpoints_first" ? "checkpoints_first" : "segments_first",
    minConfidence: Number.isFinite(minConfidence) ? minConfidence : 0.6,
    ocrTolerance: toOcrTolerance(policy.ocrTolerance)
  };
};

const normalizeSegments = (root: Record<string, unknown>): SegmentPreview[] => {
  const content = toRecord(root.content) ?? {};
  const rawSegments = [
    ...toRecordList(root.segments),
    ...toRecordList(content.segments)
  ];

  if (rawSegments.length === 0) {
    const directPoints = [
      ...toRecordList(root.answerPoints),
      ...toRecordList(content.points),
      ...toRecordList(content.steps)
    ]
      .map((point, index) => normalizePoint(point, index))
      .filter((item): item is RubricResultPoint => Boolean(item));

    if (directPoints.length === 0) {
      return [];
    }

    const totalScore = directPoints.reduce((sum, point) => sum + point.score, 0);

    return [
      {
        id: "segment-1",
        title: "默认题段",
        strategyType: "point_accumulation",
        strategyLabel: strategyLabelMap.point_accumulation ?? "按点给分",
        maxScore: totalScore,
        matchingMode: undefined,
        points: directPoints,
        dimensions: []
      }
    ];
  }

  return rawSegments.map((segment, index) => {
    const title = firstText(segment.title, segment.name, segment.segment, segment.id) || `第 ${index + 1} 段`;
    const strategyType = toStrategyType(segment.strategyType);
    const matchingMode = toMatchMode(toRecord(segment.matching)?.mode);
    const points = extractSegmentPoints(segment, title);
    const dimensions = normalizeMatrixDimensions(segment);
    const pointScore = points.reduce((sum, point) => sum + point.score, 0);
    const maxScoreCandidates = [
      Number(segment.maxScore),
      Number(toRecord(segment.content)?.totalScore),
      pointScore
    ];

    let maxScore = 0;
    for (const score of maxScoreCandidates) {
      if (Number.isFinite(score) && score > 0) {
        maxScore = score;
        break;
      }
    }

    return {
      id: firstText(segment.id) || `segment-${index + 1}`,
      title,
      strategyType,
      strategyLabel: strategyLabelMap[strategyType] ?? strategyType,
      maxScore,
      matchingMode,
      points,
      dimensions
    } satisfies SegmentPreview;
  });
};

export const buildRubricResultPreview = (input: {
  rubricText: string;
  fallbackQuestionKey: string;
  fallbackSubject: string;
  fallbackQuestionType: string;
  fallbackScore?: number;
}): RubricResultPreview => {
  const fallbackQuestionId = input.fallbackQuestionKey || "未命名题目";
  const fallbackTitle = `${input.fallbackSubject} ${input.fallbackQuestionType}`.trim() || "AI 生成评分细则";

  const fallback: RubricResultPreview = {
    title: fallbackTitle,
    questionId: fallbackQuestionId,
    subject: input.fallbackSubject || "-",
    questionType: input.fallbackQuestionType || "-",
    strategyLabel: "标准模式",
    totalScore: input.fallbackScore ?? 0,
    pointCount: 0,
    segmentAggregation: "sum",
    segments: [],
    points: [],
    constraints: [],
    globalPolicy: null
  };

  const trimmed = input.rubricText.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const root = toRecord(parsed);
    if (!root) {
      return fallback;
    }

    const metadata = toRecord(root.metadata) ?? {};
    const segments = normalizeSegments(root);
    const points = segments.flatMap((segment) => segment.points);
    const pointCount = points.length;

    const segmentScore = segments.reduce((sum, segment) => sum + (Number.isFinite(segment.maxScore) ? segment.maxScore : 0), 0);
    const pointScore = points.reduce((sum, point) => sum + (Number.isFinite(point.score) ? point.score : 0), 0);

    const totalScoreCandidates = [
      Number(metadata.totalScore),
      Number(root.totalScore),
      segmentScore,
      pointScore,
      input.fallbackScore
    ];

    let totalScore = 0;
    for (const score of totalScoreCandidates) {
      if (typeof score === "number" && Number.isFinite(score) && score > 0) {
        totalScore = score;
        break;
      }
    }

    const strategyTypes = new Set(segments.map((segment) => segment.strategyType));
    const singleStrategy = segments[0]?.strategyType;
    const strategyLabel = strategyTypes.size === 1
      ? (singleStrategy ? (strategyLabelMap[singleStrategy] ?? fallback.strategyLabel) : fallback.strategyLabel)
      : "混合策略";

    return {
      title: firstText(metadata.title) || fallbackTitle,
      questionId: firstText(metadata.questionId, root.questionId, root.questionKey) || fallbackQuestionId,
      subject: firstText(metadata.subject) || input.fallbackSubject || "-",
      questionType: firstText(metadata.questionType) || input.fallbackQuestionType || "-",
      strategyLabel,
      totalScore,
      pointCount,
      segmentAggregation: toAggregation(root.segmentAggregation),
      segments,
      points,
      constraints: normalizeConstraints(root.constraints),
      globalPolicy: normalizeGlobalPolicy(root.globalPolicy)
    };
  } catch {
    return fallback;
  }
};

export const parseKeywordInput = (value: string): string[] => {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};
