import { useEffect, useMemo, useState } from "react";
import { copyText } from "../../lib/clipboard";
import {
  applyScoreToActiveTab,
  captureAnswerImageFromActiveTab,
  fetchActiveTabContext,
  fetchLatestPageContext,
  requestPageContextFromActiveTab,
  type ActiveTabContext,
  type PageContext
} from "../../lib/extensionBridge";
import {
  evaluateGrading,
  fetchQuotaStatus,
  type GradingEvaluateResultDTO,
  type QuotaStatusDTO
} from "../../lib/api";
import { rootStoreActions } from "../../store/useRootStore";

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
  const [fillScore, setFillScore] = useState("");

  const [quota, setQuota] = useState<QuotaStatusDTO | null>(null);
  const [result, setResult] = useState<GradingEvaluateResultDTO | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);

  const [activeTabContext, setActiveTabContext] = useState<ActiveTabContext | null>(null);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [captureMeta, setCaptureMeta] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [domBusy, setDomBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const imagePreviewLabel = useMemo(() => {
    if (!imageBase64.trim()) {
      return "未提供";
    }

    if (imageBase64.startsWith("data:")) {
      return `${Math.round(imageBase64.length / 1024)} KB`;
    }

    return `${Math.round(imageBase64.length / 1024)} KB（raw）`;
  }, [imageBase64]);

  const refreshQuota = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const nextQuota = await fetchQuotaStatus();
      setQuota(nextQuota);
      rootStoreActions.setLicenseSnapshot({
        status: nextQuota.status === "active" ? "active" : (nextQuota.status === "expired" ? "expired" : "inactive"),
        remainingQuota: nextQuota.remaining
      });
      setSuccessMessage("配额状态已刷新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取配额失败");
    } finally {
      setBusy(false);
    }
  };

  const refreshExtensionContext = async (): Promise<void> => {
    setDomBusy(true);
    resetMessage();

    try {
      const [tabCtx, latestPageCtx] = await Promise.all([fetchActiveTabContext(), fetchLatestPageContext()]);
      setActiveTabContext(tabCtx);
      setPageContext(latestPageCtx);
      setSuccessMessage("已刷新扩展页面上下文");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取扩展上下文失败");
    } finally {
      setDomBusy(false);
    }
  };

  useEffect(() => {
    void refreshQuota();
    void refreshExtensionContext();
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

  useEffect(() => {
    if (!result) {
      return;
    }

    setFillScore(String(result.score));
  }, [result]);

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
      rootStoreActions.setLicenseSnapshot({
        status: gradingResult.remaining > 0 ? "active" : "expired",
        remainingQuota: gradingResult.remaining
      });
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

  const handlePullContextFromPage = async (): Promise<void> => {
    setDomBusy(true);
    resetMessage();

    try {
      const payload = await requestPageContextFromActiveTab();
      if (payload) {
        setPageContext(payload);
        if (!questionNo.trim() && payload.questionNo) {
          setQuestionNo(payload.questionNo);
        }
      }
      setSuccessMessage("已请求页面上下文");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "请求页面上下文失败");
    } finally {
      setDomBusy(false);
    }
  };

  const handleCaptureFromPage = async (): Promise<void> => {
    setDomBusy(true);
    resetMessage();

    try {
      const capture = await captureAnswerImageFromActiveTab();
      setImageBase64(capture.imageBase64);
      if (!questionNo.trim() && capture.questionNo) {
        setQuestionNo(capture.questionNo);
      }

      setCaptureMeta(`${capture.platform} | ${capture.elementTag} | ${capture.selector}`);
      setSuccessMessage("已从页面抓取答案图像");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "抓取答案图像失败");
    } finally {
      setDomBusy(false);
    }
  };

  const handleApplyScoreToPage = async (autoSubmit: boolean): Promise<void> => {
    const nextScore = Number(fillScore);
    if (!Number.isFinite(nextScore)) {
      setErrorMessage("请先输入合法分数");
      return;
    }

    setDomBusy(true);
    resetMessage();

    try {
      const payload = await applyScoreToActiveTab({ score: nextScore, autoSubmit });
      if (!payload.success) {
        throw new Error(payload.error ?? "回填失败");
      }

      setSuccessMessage(
        payload.submitted
          ? `分数已回填并提交（${payload.method ?? "unknown"}）`
          : `分数已回填（${payload.method ?? "unknown"}）`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "回填分数失败");
    } finally {
      setDomBusy(false);
    }
  };

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>阅卷批改</h2>
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
          <label htmlFor="grading-question-no">题号（questionNo）</label>
          <input
            id="grading-question-no"
            type="text"
            value={questionNo}
            onChange={(event) => setQuestionNo(event.target.value)}
            placeholder="Q1"
          />
        </div>

        <div className="field-group">
          <label htmlFor="grading-exam-no">考试号（examNo）</label>
          <input
            id="grading-exam-no"
            type="text"
            value={examNo}
            onChange={(event) => setExamNo(event.target.value)}
          />
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void refreshExtensionContext()} disabled={domBusy}>
          刷新扩展上下文
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handlePullContextFromPage()} disabled={domBusy}>
          同步页面题号
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleCaptureFromPage()} disabled={domBusy}>
          从页面抓答案图
        </button>
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
        <p className="hint">当前图像大小：{imagePreviewLabel}</p>
        {captureMeta ? <p className="hint">抓取来源：{captureMeta}</p> : null}
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

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="grading-fill-score">回填分数</label>
          <input
            id="grading-fill-score"
            type="number"
            value={fillScore}
            onChange={(event) => setFillScore(event.target.value)}
            placeholder="例如 8"
          />
        </div>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void handleApplyScoreToPage(false)}
          disabled={domBusy || !fillScore.trim()}
        >
          回填分数（不提交）
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => void handleApplyScoreToPage(true)}
          disabled={domBusy || !fillScore.trim()}
        >
          回填并提交
        </button>
      </div>

      {lastDurationMs !== null ? <p className="hint">最近批改耗时：{lastDurationMs} ms</p> : null}

      {activeTabContext ? (
        <div className="status-box">
          <h3>当前标签页上下文</h3>
          <pre>{JSON.stringify(activeTabContext, null, 2)}</pre>
        </div>
      ) : null}

      {pageContext ? (
        <div className="status-box">
          <h3>页面识别上下文</h3>
          <pre>{JSON.stringify(pageContext, null, 2)}</pre>
        </div>
      ) : null}

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
