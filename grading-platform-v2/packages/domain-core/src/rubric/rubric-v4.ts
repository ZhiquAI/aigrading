/**
 * rubric-v4.ts - 评分细则 v4 纯类型定义
 *
 * 设计原则：
 * - Segment 化：每道题拆为一个或多个 Segment，各自有独立的策略和匹配规则
 * - Union Content：每个 Segment 的 content 严格对应其 strategyType（不允许歧义字段）
 * - 向前兼容 v3：单段 v3 细则可包装为单 Segment 的 v4
 */

// ── 枚举类型 ──

export type StrategyType = 'point_accumulation' | 'sequential_logic' | 'rubric_matrix';

export type SegmentAggregation = 'sum' | 'weighted_sum' | 'max';

export type MatchMode = 'strict' | 'keyword' | 'semantic';

export type ScoringType = 'all' | 'pick_n' | 'weighted';

export type ConstraintType = 'deduction_fixed' | 'deduction_per_count' | 'score_cap' | 'logic_check';

export type QuestionType = 'single' | 'mixed';

export type OcrTolerance = 'low' | 'medium' | 'high';

export type ConflictPolicy = 'checkpoints_first' | 'segments_first';

// ── 基础结构 ──

export interface ScoringStrategyV4 {
  type: ScoringType;
  maxPoints?: number;
  pointValue?: number;
  allowAlternative?: boolean;
  strictMode?: boolean;
}

export interface MatchingConfigV4 {
  mode: MatchMode;
  strictMode?: boolean;
  allowAlternative?: boolean;
}

export interface ConstraintV4 {
  id: string;
  type: ConstraintType;
  config: Record<string, unknown>;
}

// ── 段内内容：Union 类型（核心设计，与 v3 保持一致的严格校验模式） ──

export interface RubricPointV4 {
  id: string;
  content: string;
  score: number;
  keywords?: string[];
  questionSegment?: string;
  requiredKeywords?: string[];
  deductionRules?: string;
  openEnded?: boolean;
  order?: number;
}

export interface PointAccumulationContentV4 {
  scoringStrategy: ScoringStrategyV4;
  points: RubricPointV4[];
  totalScore?: number;
}

export interface SequentialLogicStepV4 {
  id: string;
  content: string;
  score: number;
  dependsOn?: string[];
  keywords?: string[];
  order?: number;
}

export interface SequentialLogicContentV4 {
  scoringStrategy: ScoringStrategyV4;
  steps: SequentialLogicStepV4[];
  requireOrder?: boolean;
  totalScore?: number;
}

export interface RubricDimensionLevelV4 {
  label: string;
  score: number;
  description?: string;
}

export interface RubricDimensionV4 {
  id: string;
  name: string;
  weight?: number;
  levels: RubricDimensionLevelV4[];
}

export interface RubricMatrixContentV4 {
  dimensions: RubricDimensionV4[];
  totalScore?: number;
}

/**
 * Segment 内容为严格 Union：由 strategyType 决定 content 的具体形状。
 * - point_accumulation → PointAccumulationContentV4
 * - sequential_logic  → SequentialLogicContentV4
 * - rubric_matrix     → RubricMatrixContentV4
 */
export type SegmentContentV4 =
  | PointAccumulationContentV4
  | SequentialLogicContentV4
  | RubricMatrixContentV4;

// ── Segment ──

export interface SegmentV4 {
  id: string;
  title: string;
  questionType: string;
  strategyType: StrategyType;
  maxScore: number;
  weight?: number;
  matching: MatchingConfigV4;
  scoring: ScoringStrategyV4;
  content: SegmentContentV4;
  constraints?: ConstraintV4[];
}

// ── 全局策略 ──

export interface GlobalPolicyV4 {
  conflictPolicy: ConflictPolicy;
  minConfidence: number;
  ocrTolerance: OcrTolerance;
}

// ── 元数据 ──

export interface RubricMetadataV4 {
  subject: string;
  grade?: string;
  examName?: string;
  questionId: string;
  questionType: QuestionType;
  totalScore: number;
  tags?: string[];
}

// ── 主结构 ──

export interface RubricV4 {
  version: '4.0';
  metadata: RubricMetadataV4;
  globalPolicy: GlobalPolicyV4;
  segments: SegmentV4[];
  segmentAggregation: SegmentAggregation;
  constraints?: ConstraintV4[];
  createdAt: string;
  updatedAt: string;
}

// ── 类型守卫 ──

export function isStrategyType(value: unknown): value is StrategyType {
  return value === 'point_accumulation' || value === 'sequential_logic' || value === 'rubric_matrix';
}

export function isRubricV4(value: unknown): value is RubricV4 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RubricV4>;
  return candidate.version === '4.0'
    && !!candidate.metadata
    && !!candidate.globalPolicy
    && Array.isArray(candidate.segments)
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string';
}
