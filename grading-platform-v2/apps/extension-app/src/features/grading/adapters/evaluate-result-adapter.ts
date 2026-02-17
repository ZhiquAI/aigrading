import type { GradingResult } from "@ai-grading/domain-core";
import type { GradingEvaluateResultDTO } from "../../../lib/api";

type AdaptEvaluateResponseInput = {
  evaluateResult: GradingEvaluateResultDTO;
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

  throw new Error("评分结果缺少 gradingResult（v4 结构），请检查 /api/v2/gradings/evaluate 返回值。");
};
