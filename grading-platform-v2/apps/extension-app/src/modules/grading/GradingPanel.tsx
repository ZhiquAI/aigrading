import { useEffect, useState } from "react";
import { copyText } from "../../lib/clipboard";
import {
  evaluateGrading,
  fetchQuotaStatus,
  type GradingEvaluateResultDTO,
  type QuotaStatusDTO
} from "../../lib/api";

type GradingPanelProps = {
  questionKey: string;
  examId: string;
  examName: string;
  rubricText: string;
  onGradingCompleted?: (payload: {
    score: number;
    maxScore: number;
    comment: string;
    breakdown: unknown;
    studentName: string;
    questionNo: string;
    questionKey: string;
    examNo: string;
  }) => void;
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
  };

  const points = Array.isArray(rubricObj.answerPoints)
    ? rubricObj.answerPoints
    : Array.isArray(rubricObj.content?.points)
      ? rubricObj.content?.points
      : null;

  if (!points || points.length === 0) {
    throw new Error("Rubric 缺少 answerPoints/content.points");
  }
};

export const GradingPanel = ({ questionKey, examId, examName, rubricText, onGradingCompleted }: GradingPanelProps) => {
  const [studentName, setStudentName] = useState("张三");
  const [questionNo, setQuestionNo] = useState("");
  const [examNo, setExamNo] = useState("EX-2026-001");
  const [imageBase64, setImageBase64] = useState("");
  const [quota, setQuota] = useState<QuotaStatusDTO | null>(null);
  const [result, setResult] = useState<GradingEvaluateResultDTO | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const refreshQuota = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const nextQuota = await fetchQuotaStatus();
      setQuota(nextQuota);
      setSuccessMessage("配额状态已刷新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取配额失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshQuota();
  }, []);

  useEffect(() => {
    if (!questionNo.trim() && questionKey.trim()) {
      setQuestionNo(questionKey.trim());
    }
  }, [questionKey]);

  useEffect(() => {
    if (!examNo.trim() && examId.trim()) {
      setExamNo(examName.trim() || examId.trim());
    }
  }, [examId, examName]);

  const handleEvaluate = async (): Promise<void> => {
    setBusy(true);
    resetMessage();
    const startedAt = performance.now();

    try {
      const parsedRubric = parseRubricInput(rubricText);
      validateRubricShape(parsedRubric);

      const gradingResult = await evaluateGrading({
        rubric: parsedRubric,
        studentName: studentName.trim() || undefined,
        questionNo: questionNo.trim() || undefined,
        questionKey: questionKey.trim() || undefined,
        examNo: examNo.trim() || undefined,
        imageBase64: imageBase64.trim() || undefined
      });

      setResult(gradingResult);
      setQuota((current) => ({
        remaining: gradingResult.remaining,
        totalUsed: gradingResult.totalUsed,
        isPaid: current?.isPaid ?? false,
        status: gradingResult.remaining > 0 ? "active" : "expired"
      }));
      setSuccessMessage(`批改完成（${gradingResult.provider}）`);

      onGradingCompleted?.({
        score: gradingResult.score,
        maxScore: gradingResult.maxScore,
        comment: gradingResult.comment,
        breakdown: gradingResult.breakdown,
        studentName: studentName.trim() || "未知",
        questionNo: questionNo.trim() || questionKey.trim(),
        questionKey: questionKey.trim(),
        examNo: examNo.trim() || examName.trim() || examId.trim()
      });
      setLastDurationMs(Math.round(performance.now() - startedAt));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "批改失败");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyResult = async (): Promise<void> => {
    if (!result) {
      setErrorMessage("当前没有评分结果可复制");
      return;
    }

    try {
      await copyText(JSON.stringify(result, null, 2));
      setSuccessMessage("评分结果 JSON 已复制");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "复制评分结果失败");
    }
  };

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>Grading</h2>
        <span className="hint">接口: /api/v2/gradings/evaluate</span>
      </header>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="grading-student">学生姓名</label>
          <input
            id="grading-student"
            type="text"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="grading-question-no">Question No</label>
          <input
            id="grading-question-no"
            type="text"
            value={questionNo}
            onChange={(event) => setQuestionNo(event.target.value)}
            placeholder="Q1"
          />
        </div>

        <div className="field-group">
          <label htmlFor="grading-exam-no">Exam No</label>
          <input
            id="grading-exam-no"
            type="text"
            value={examNo}
            onChange={(event) => setExamNo(event.target.value)}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="grading-image-base64">答案图片 Base64（可选）</label>
        <textarea
          id="grading-image-base64"
          value={imageBase64}
          onChange={(event) => setImageBase64(event.target.value)}
          rows={3}
          placeholder="data:image/png;base64,..."
        />
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void refreshQuota()} disabled={busy}>
          刷新配额
        </button>
        <button type="button" className="primary-btn" onClick={() => void handleEvaluate()} disabled={busy}>
          开始批改
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleCopyResult()} disabled={busy || !result}>
          复制结果 JSON
        </button>
      </div>

      {lastDurationMs !== null ? <p className="hint">最近批改耗时：{lastDurationMs} ms</p> : null}

      {quota ? (
        <div className="status-box">
          <h3>配额状态</h3>
          <pre>{JSON.stringify(quota, null, 2)}</pre>
        </div>
      ) : null}

      {result ? (
        <div className="status-box">
          <h3>评分结果</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
