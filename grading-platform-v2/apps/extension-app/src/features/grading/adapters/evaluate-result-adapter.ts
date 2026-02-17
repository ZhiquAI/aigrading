import { fromFlatBreakdown, type GradingResult } from "@ai-grading/domain-core";
import type { GradingEvaluateResultDTO } from "../../../lib/api";

type AdaptEvaluateResponseInput = {
  evaluateResult: GradingEvaluateResultDTO;
  studentName: string;
  questionNo: string;
  questionKey: string;
  examNo: string;
};

const normalizeValue = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const adaptEvaluateResponseToGradingResult = (input: AdaptEvaluateResponseInput): GradingResult => {
  const { evaluateResult } = input;

  if (evaluateResult.gradingResult) {
    return {
      ...evaluateResult.gradingResult,
      remaining: evaluateResult.remaining,
      totalUsed: evaluateResult.totalUsed
    };
  }

  return {
    ...fromFlatBreakdown({
      id: `legacy-${Date.now()}`,
      studentName: normalizeValue(input.studentName, "未知"),
      questionNo: normalizeValue(input.questionNo, normalizeValue(input.questionKey, "未识别")),
      questionKey: normalizeValue(input.questionKey, "unknown"),
      examNo: normalizeValue(input.examNo, "unknown"),
      score: evaluateResult.score,
      maxScore: evaluateResult.maxScore,
      comment: evaluateResult.comment,
      breakdown: evaluateResult.breakdown,
      provider: evaluateResult.provider,
      timestamp: Date.now()
    }),
    remaining: evaluateResult.remaining,
    totalUsed: evaluateResult.totalUsed
  };
};
