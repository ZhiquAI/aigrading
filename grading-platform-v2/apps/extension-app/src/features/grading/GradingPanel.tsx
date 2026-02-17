import { useEffect, useMemo, useRef, useState } from "react";
import { GradingModeSelector, GradingScoreCard, type GradingMode } from "@ai-grading/ui-kit";
import { copyText } from "../../lib/clipboard";
import { rootStoreActions, useRootStore } from "../../store/useRootStore";
import { useGradingController } from "./hooks/useGradingController";
import { useGradingEvaluate } from "./hooks/useGradingEvaluate";
import { useGradingPageOps } from "./hooks/useGradingPageOps";
import type { GradingResult } from "@ai-grading/domain-core";

type GradingPanelProps = {
  questionKey: string;
  examId: string;
  examName: string;
  rubricText: string;
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

const parseScoreInput = (raw: string): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("请先输入合法分数");
  }
  return parsed;
};

export const GradingPanel = ({ questionKey, examId, examName, rubricText, onGradingCompleted }: GradingPanelProps) => {
  const [studentName, setStudentName] = useState("张三");
  const [questionNo, setQuestionNo] = useState("");
  const [examNo, setExamNo] = useState("EX-2026-001");
  const [imageBase64, setImageBase64] = useState("");
  const [fillScore, setFillScore] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const gradingMode = useRootStore((store) => store.settingsSlice.gradingMode);
  const mode = gradingMode as GradingMode;

  const {
    busy,
    quota,
    result,
    gradingResult,
    lastDurationMs,
    refreshQuota,
    runEvaluate
  } = useGradingEvaluate({
    rubricText,
    questionKey,
    examId,
    examName,
    onGradingCompleted
  });

  const {
    domBusy,
    activeTabContext,
    pageContext,
    captureMeta,
    setPageContext,
    refreshExtensionContext,
    pullContextFromPage,
    captureFromPage,
    applyScore
  } = useGradingPageOps();

  const formRef = useRef({
    studentName,
    questionNo,
    examNo,
    imageBase64
  });

  useEffect(() => {
    formRef.current = {
      studentName,
      questionNo,
      examNo,
      imageBase64
    };
  }, [examNo, imageBase64, questionNo, studentName]);

  const resetMessage = (): void => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const updateSuccess = (message: string): void => {
    setSuccessMessage(message);
    setErrorMessage(null);
  };

  const updateError = (error: unknown, fallback: string): void => {
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setSuccessMessage(null);
  };

  const handleApplyScore = async (score: number, autoSubmit: boolean): Promise<void> => {
    const applied = await applyScore(score, autoSubmit);
    updateSuccess(
      applied.submitted
        ? `分数已回填并提交（${applied.method}）`
        : `分数已回填（${applied.method}）`
    );
  };

  const controller = useGradingController({
    onScanPage: async () => {
      const capture = await captureFromPage();
      setImageBase64(capture.imageBase64);
      formRef.current.imageBase64 = capture.imageBase64;
      if (!formRef.current.questionNo.trim() && capture.questionNo) {
        setQuestionNo(capture.questionNo);
        formRef.current.questionNo = capture.questionNo;
      }
      updateSuccess(`已抓取页面图像：${capture.captureMeta}`);
      return { signature: capture.signature };
    },
    onEvaluate: async () => {
      const adapted = await runEvaluate({
        studentName: formRef.current.studentName,
        questionNo: formRef.current.questionNo,
        examNo: formRef.current.examNo,
        imageBase64: formRef.current.imageBase64
      });
      setFillScore(String(adapted.score));
      updateSuccess("批改完成，进入审阅阶段");
      return { score: adapted.score };
    },
    onApply: async (score, autoSubmit) => {
      await handleApplyScore(score, autoSubmit);
    }
  });

  useEffect(() => {
    if (!questionNo.trim() && questionKey.trim()) {
      const next = questionKey.trim();
      setQuestionNo(next);
      formRef.current.questionNo = next;
    }
  }, [questionKey, questionNo]);

  useEffect(() => {
    if (!examNo.trim() && (examName.trim() || examId.trim())) {
      const next = examName.trim() || examId.trim();
      setExamNo(next);
      formRef.current.examNo = next;
    }
  }, [examId, examName, examNo]);

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        await Promise.all([refreshQuota(), refreshExtensionContext()]);
      } catch (error) {
        updateError(error, "初始化上下文失败");
      }
    };
    void bootstrap();
  }, [refreshExtensionContext, refreshQuota]);

  useEffect(() => {
    if (controller.error) {
      setErrorMessage(controller.error);
      setSuccessMessage(null);
    }
  }, [controller.error]);

  const imagePreviewLabel = useMemo(() => {
    if (!imageBase64.trim()) {
      return "未提供";
    }

    if (imageBase64.startsWith("data:")) {
      return `${Math.round(imageBase64.length / 1024)} KB`;
    }

    return `${Math.round(imageBase64.length / 1024)} KB（raw）`;
  }, [imageBase64]);

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>阅卷批改</h2>
        <span className="hint">接口: /api/v2/gradings/evaluate</span>
      </header>

      <div className="field-group">
        <label>批改模式</label>
        <GradingModeSelector
          mode={mode}
          disabled={busy || domBusy || controller.isRunning}
          onChange={(nextMode) => {
            rootStoreActions.setSettingsSnapshot({ gradingMode: nextMode });
            resetMessage();
          }}
        />
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="grading-student">学生姓名</label>
          <input
            id="grading-student"
            type="text"
            value={studentName}
            onChange={(event) => {
              const value = event.target.value;
              setStudentName(value);
              formRef.current.studentName = value;
            }}
          />
        </div>

        <div className="field-group">
          <label htmlFor="grading-question-no">题号（questionNo）</label>
          <input
            id="grading-question-no"
            type="text"
            value={questionNo}
            onChange={(event) => {
              const value = event.target.value;
              setQuestionNo(value);
              formRef.current.questionNo = value;
            }}
            placeholder="Q1"
          />
        </div>

        <div className="field-group">
          <label htmlFor="grading-exam-no">考试号（examNo）</label>
          <input
            id="grading-exam-no"
            type="text"
            value={examNo}
            onChange={(event) => {
              const value = event.target.value;
              setExamNo(value);
              formRef.current.examNo = value;
            }}
          />
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void refreshExtensionContext()} disabled={domBusy}>
          刷新扩展上下文
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            void pullContextFromPage()
              .then((payload) => {
                if (!payload) {
                  return;
                }
                setPageContext(payload);
                if (!questionNo.trim() && payload.questionNo) {
                  setQuestionNo(payload.questionNo);
                  formRef.current.questionNo = payload.questionNo;
                }
                updateSuccess("已请求页面上下文");
              })
              .catch((error) => updateError(error, "请求页面上下文失败"));
          }}
          disabled={domBusy}
        >
          同步页面题号
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            void captureFromPage()
              .then((capture) => {
                setImageBase64(capture.imageBase64);
                formRef.current.imageBase64 = capture.imageBase64;
                if (!questionNo.trim() && capture.questionNo) {
                  setQuestionNo(capture.questionNo);
                  formRef.current.questionNo = capture.questionNo;
                }
                updateSuccess("已从页面抓取答案图像");
              })
              .catch((error) => updateError(error, "抓取答案图像失败"));
          }}
          disabled={domBusy}
        >
          从页面抓答案图
        </button>
      </div>

      <div className="field-group">
        <label htmlFor="grading-image-base64">答案图片 Base64（可选）</label>
        <textarea
          id="grading-image-base64"
          value={imageBase64}
          onChange={(event) => {
            const value = event.target.value;
            setImageBase64(value);
            formRef.current.imageBase64 = value;
          }}
          rows={3}
          placeholder="data:image/png;base64,..."
        />
        <p className="hint">当前图像大小：{imagePreviewLabel}</p>
        {captureMeta ? <p className="hint">抓取来源：{captureMeta}</p> : null}
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            void refreshQuota()
              .then(() => updateSuccess("配额状态已刷新"))
              .catch((error) => updateError(error, "读取配额失败"));
          }}
          disabled={busy}
        >
          刷新配额
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            if (mode === "assist") {
              void controller.startAssist().catch((error) => updateError(error, "辅助模式启动失败"));
              return;
            }
            void controller.startAuto().catch((error) => updateError(error, "自动模式启动失败"));
          }}
          disabled={busy || domBusy || controller.isRunning}
        >
          {mode === "assist" ? "开始辅助阅卷" : "开始自动阅卷"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            void runEvaluate({
              studentName,
              questionNo,
              examNo,
              imageBase64
            })
              .then((next) => {
                setFillScore(String(next.score));
                updateSuccess("单次批改完成");
              })
              .catch((error) => updateError(error, "批改失败"));
          }}
          disabled={busy || domBusy}
        >
          单次批改
        </button>
        <button type="button" className="secondary-btn" onClick={controller.stop} disabled={!controller.isRunning}>
          停止
        </button>
        <button type="button" className="secondary-btn" onClick={controller.pause} disabled={!controller.isRunning || mode !== "auto"}>
          暂停
        </button>
        <button type="button" className="secondary-btn" onClick={controller.resume} disabled={!controller.isPaused || mode !== "auto"}>
          继续
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void controller.retry().catch((error) => updateError(error, "重试失败"))}
          disabled={controller.status !== "error"}
        >
          重试
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
          onClick={() => {
            try {
              const parsedScore = parseScoreInput(fillScore);
              void handleApplyScore(parsedScore, false).catch((error) => updateError(error, "回填分数失败"));
            } catch (error) {
              updateError(error, "回填分数失败");
            }
          }}
          disabled={domBusy || !fillScore.trim()}
        >
          回填分数（不提交）
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            try {
              const parsedScore = parseScoreInput(fillScore);
              void handleApplyScore(parsedScore, true).catch((error) => updateError(error, "回填并提交失败"));
            } catch (error) {
              updateError(error, "回填并提交失败");
            }
          }}
          disabled={domBusy || !fillScore.trim()}
        >
          回填并提交
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            void controller.confirmApply()
              .then(() => updateSuccess("辅助模式已确认回填"))
              .catch((error) => updateError(error, "确认回填失败"));
          }}
          disabled={controller.pendingScore === null}
        >
          确认待回填分数
        </button>
      </div>

      <div className="status-box">
        <h3>状态机状态</h3>
        <pre>{JSON.stringify({
          mode: controller.mode,
          status: controller.status,
          step: controller.step,
          cycleCount: controller.cycleCount,
          pendingScore: controller.pendingScore,
          controllerError: controller.error
        }, null, 2)}</pre>
      </div>

      {lastDurationMs !== null ? <p className="hint">最近批改耗时：{lastDurationMs} ms</p> : null}

      {gradingResult ? (
        <div className="status-box">
          <h3>结构化评分结果</h3>
          <GradingScoreCard
            result={gradingResult}
            onApply={(nextResult) => {
              setFillScore(String(nextResult.score));
              void handleApplyScore(nextResult.score, false).catch((error) => updateError(error, "确认回填失败"));
            }}
          />
        </div>
      ) : null}

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
          <h3>评分结果（原始响应）</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <div className="btn-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                void copyText(JSON.stringify(result, null, 2))
                  .then(() => updateSuccess("评分结果 JSON 已复制"))
                  .catch((error) => updateError(error, "复制评分结果失败"));
              }}
            >
              复制结果 JSON
            </button>
          </div>
        </div>
      ) : null}

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
