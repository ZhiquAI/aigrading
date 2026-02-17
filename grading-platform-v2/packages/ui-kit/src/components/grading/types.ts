export type GradingStrategyType = "point_accumulation" | "sequential_logic" | "rubric_matrix";
export type SegmentAggregation = "sum" | "weighted_sum" | "max";

export type GradingPointItem = {
  type: "point";
  pointId: string;
  label: string;
  score: number;
  maxScore: number;
  matched: boolean;
  comment?: string;
  matchedText?: string;
};

export type GradingStepItem = {
  type: "step";
  stepId: string;
  label: string;
  score: number;
  maxScore: number;
  matched: boolean;
  comment?: string;
  matchedText?: string;
  skippedByDependency?: boolean;
};

export type GradingDimensionItem = {
  type: "dimension";
  dimensionId: string;
  dimensionName: string;
  selectedLevel: string;
  score: number;
  maxScore: number;
  comment?: string;
};

export type GradingSegmentItem = GradingPointItem | GradingStepItem | GradingDimensionItem;

export type GradingSegmentResult = {
  segmentId: string;
  title: string;
  strategyType: GradingStrategyType;
  score: number;
  maxScore: number;
  comment?: string;
  items: GradingSegmentItem[];
};

export type GradingResultViewModel = {
  id: string;
  studentName: string;
  questionNo: string;
  questionKey: string;
  examNo: string;
  score: number;
  maxScore: number;
  comment: string;
  segments: GradingSegmentResult[];
  segmentAggregation: SegmentAggregation;
  provider?: string;
  model?: string;
  durationMs?: number;
  timestamp: number;
  remaining?: number;
  totalUsed?: number;
};
