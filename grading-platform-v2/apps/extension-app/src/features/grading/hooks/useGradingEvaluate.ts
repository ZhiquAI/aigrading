import { useCallback, useState } from "react";
import {
  evaluateGrading,
  fetchQuotaStatus,
  type GradingEvaluateResultDTO,
  type QuotaStatusDTO
} from "../../../lib/api";
import { rootStoreActions } from "../../../store/useRootStore";
import { adaptEvaluateResponseToGradingResult } from "../adapters/evaluate-result-adapter";
import type { GradingResult } from "@ai-grading/domain-core";

type UseGradingEvaluateParams = {
  rubricText: string;
  questionKey: string;
  examId: string;
  examName: string;
  onGradingCompleted?: (payload: {
    score: number;
    maxScore: number;
    comment: string;
    breakdown: GradingResult;
    studentName: string;
    questionNo: string;
    questionKey: string;
    examNo: string;
  }) => void;
};

type EvaluateInput = {
  studentName: string;
  questionNo: string;
  examNo: string;
  imageBase64: string;
};

const parseRubricInput = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请先准备 Rubric");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

const validateRubricShape = (rubric: unknown): void => {
  if (!rubric || typeof rubric !== "object") {
    return;
  }

  const rubricObj = rubric as {
    answerPoints?: unknown[];
    content?: { points?: unknown[] };
    segments?: unknown[];
  };

  const points = Array.isArray(rubricObj.answerPoints)
    ? rubricObj.answerPoints
    : Array.isArray(rubricObj.content?.points)
      ? rubricObj.content?.points
      : null;

  if ((points && points.length > 0) || (Array.isArray(rubricObj.segments) && rubricObj.segments.length > 0)) {
    return;
  }

  throw new Error("Rubric 缺少 answerPoints/content.points/segments");
};

export const useGradingEvaluate = ({
  rubricText,
  questionKey,
  examId,
  examName,
  onGradingCompleted
}: UseGradingEvaluateParams) => {
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<QuotaStatusDTO | null>(null);
  const [result, setResult] = useState<GradingEvaluateResultDTO | null>(null);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  const refreshQuota = useCallback(async (): Promise<QuotaStatusDTO> => {
    const nextQuota = await fetchQuotaStatus();
    setQuota(nextQuota);
    rootStoreActions.setLicenseSnapshot({
      status: nextQuota.status === "active" ? "active" : (nextQuota.status === "expired" ? "expired" : "inactive"),
      remainingQuota: nextQuota.remaining
    });
    return nextQuota;
  }, []);

  const runEvaluate = useCallback(async (input: EvaluateInput): Promise<GradingResult> => {
    setBusy(true);
    const startedAt = performance.now();

    try {
      const parsedRubric = parseRubricInput(rubricText);
      validateRubricShape(parsedRubric);

      const evaluateResult = await evaluateGrading({
        rubric: parsedRubric,
        studentName: input.studentName.trim() || undefined,
        questionNo: input.questionNo.trim() || undefined,
        questionKey: questionKey.trim() || undefined,
        examNo: input.examNo.trim() || undefined,
        imageBase64: input.imageBase64.trim() || undefined
      });

      const normalizedQuestionNo = input.questionNo.trim() || questionKey.trim();
      const normalizedExamNo = input.examNo.trim() || examName.trim() || examId.trim();
      const adapted = adaptEvaluateResponseToGradingResult({
        evaluateResult
      });

      setResult(evaluateResult);
      setGradingResult(adapted);
      setQuota((current) => ({
        remaining: evaluateResult.remaining,
        totalUsed: evaluateResult.totalUsed,
        isPaid: current?.isPaid ?? false,
        status: evaluateResult.remaining > 0 ? "active" : "expired"
      }));
      rootStoreActions.setLicenseSnapshot({
        status: evaluateResult.remaining > 0 ? "active" : "expired",
        remainingQuota: evaluateResult.remaining
      });
      onGradingCompleted?.({
        score: evaluateResult.score,
        maxScore: evaluateResult.maxScore,
        comment: evaluateResult.comment,
        breakdown: adapted,
        studentName: input.studentName.trim() || "未知",
        questionNo: normalizedQuestionNo,
        questionKey: questionKey.trim(),
        examNo: normalizedExamNo
      });
      setLastDurationMs(Math.round(performance.now() - startedAt));

      return adapted;
    } finally {
      setBusy(false);
    }
  }, [examId, examName, onGradingCompleted, questionKey, rubricText]);

  return {
    busy,
    quota,
    result,
    gradingResult,
    lastDurationMs,
    refreshQuota,
    runEvaluate,
    setGradingResult
  };
};
