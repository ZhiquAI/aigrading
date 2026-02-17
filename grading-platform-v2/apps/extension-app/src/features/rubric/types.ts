import type {
  ConstraintV4,
  GlobalPolicyV4,
  MatchMode,
  SegmentAggregation,
  StrategyType
} from "@ai-grading/domain-core";

export type ViewState = "input" | "generating" | "result";

export type EntryIntent = "input" | "list" | "import";

export type RubricResultPoint = {
  id: string;
  questionSegment: string;
  content: string;
  score: number;
  keywords: string[];
};

export type RubricMatrixLevelPreview = {
  label: string;
  score: number;
  description: string;
};

export type RubricMatrixDimensionPreview = {
  id: string;
  name: string;
  weight: number;
  levels: RubricMatrixLevelPreview[];
};

export type SegmentPreview = {
  id: string;
  title: string;
  strategyType: StrategyType;
  strategyLabel: string;
  maxScore: number;
  matchingMode?: MatchMode;
  points: RubricResultPoint[];
  dimensions: RubricMatrixDimensionPreview[];
};

export type RubricResultPreview = {
  title: string;
  questionId: string;
  subject: string;
  questionType: string;
  strategyLabel: string;
  totalScore: number;
  pointCount: number;
  segmentAggregation: SegmentAggregation;
  segments: SegmentPreview[];
  points: RubricResultPoint[];
  constraints: ConstraintV4[];
  globalPolicy: GlobalPolicyV4 | null;
};

export type RubricFormState = {
  examName: string;
  grade: string;
  subject: string;
  questionType: string;
  totalScore: string;
  specialRulesText: string;
  questionImage: string | null;
  answerImage: string | null;
};
