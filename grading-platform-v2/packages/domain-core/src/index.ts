import type { ScopeIdentity } from "@ai-grading/api-contracts";

export type ScopeResolveInput = {
  activationCode?: string | null;
  deviceId?: string | null;
  anonymousSeed?: string;
};

export const normalizeNonEmpty = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const normalizeActivationCode = (value?: string | null): string | undefined => {
  const trimmed = normalizeNonEmpty(value);
  return trimmed ? trimmed.toUpperCase() : undefined;
};

export const buildActivationScopeKey = (activationCode: string): string => `ac:${activationCode}`;

export const buildDeviceScopeKey = (deviceId: string): string => `device:${deviceId}`;

export const buildAnonymousScopeKey = (seed: string): string => `anon:${seed}`;

// ── Rubric v4 类型 ──
export type {
  StrategyType, SegmentAggregation, MatchMode, ScoringType, ConstraintType,
  QuestionType, OcrTolerance, ConflictPolicy,
  ScoringStrategyV4, MatchingConfigV4, ConstraintV4,
  RubricPointV4, PointAccumulationContentV4,
  SequentialLogicStepV4, SequentialLogicContentV4,
  RubricDimensionLevelV4, RubricDimensionV4, RubricMatrixContentV4,
  SegmentContentV4, SegmentV4, GlobalPolicyV4, RubricMetadataV4, RubricV4,
} from './rubric/rubric-v4';
export { isStrategyType, isRubricV4 } from './rubric/rubric-v4';

// ── Grading Result 类型 ──
export type {
  PointItemResult, StepItemResult, DimensionItemResult,
  SegmentResult, SegmentItemResult,
  GradingResult, FlatBreakdownItem,
} from './grading/grading-result';
export { flattenGradingResult, fromFlatBreakdown } from './grading/grading-result';

export const resolveScopeIdentity = (input: ScopeResolveInput): ScopeIdentity => {
  const activationCode = normalizeActivationCode(input.activationCode);
  if (activationCode) {
    return {
      scopeKey: buildActivationScopeKey(activationCode),
      scopeType: "activation",
      activationCode
    };
  }

  const deviceId = normalizeNonEmpty(input.deviceId);
  if (deviceId) {
    return {
      scopeKey: buildDeviceScopeKey(deviceId),
      scopeType: "device",
      deviceId
    };
  }

  const fallbackSeed = normalizeNonEmpty(input.anonymousSeed) || crypto.randomUUID();
  return {
    scopeKey: buildAnonymousScopeKey(fallbackSeed),
    scopeType: "anonymous"
  };
};
