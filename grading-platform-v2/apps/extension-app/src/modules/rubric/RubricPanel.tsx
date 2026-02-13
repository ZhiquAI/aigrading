import { useState } from "react";
import {
  deleteRubricByQuestionKey,
  fetchRubricByQuestionKey,
  fetchRubricSummaries,
  generateRubric,
  standardizeRubric,
  type RubricLifecycleStatus,
  type RubricSummaryDTO,
  upsertRubric
} from "../../lib/api";

type RubricPanelProps = {
  questionKey: string;
  onQuestionKeyChange: (value: string) => void;
  examId: string;
  onExamIdChange: (value: string) => void;
  rubricText: string;
  onRubricTextChange: (value: string) => void;
};

const parseRubricInput = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请先输入 Rubric JSON 或文本内容");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

const toPrettyString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseScore = (raw: string): number | undefined => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const EXAMPLE_RUBRIC = JSON.stringify(
  {
    version: "2.0",
    scoringStrategy: "all",
    answerPoints: [
      {
        id: "p1",
        content: "准确概述事件背景与时间线",
        keywords: ["背景", "时间线", "史实"],
        score: 4
      },
      {
        id: "p2",
        content: "阐明核心原因并有因果联系",
        keywords: ["原因", "因果", "逻辑"],
        score: 3
      },
      {
        id: "p3",
        content: "说明影响并给出简要结论",
        keywords: ["影响", "结论"],
        score: 3
      }
    ],
    gradingNotes: "先按要点命中给分，再结合表达完整性做小幅浮动。",
    metadata: {
      questionId: "Q1",
      title: "示例评分细则"
    }
  },
  null,
  2
);

export const RubricPanel = ({
  questionKey,
  onQuestionKeyChange,
  examId,
  onExamIdChange,
  rubricText,
  onRubricTextChange
}: RubricPanelProps) => {
  const [lifecycleStatus, setLifecycleStatus] = useState<RubricLifecycleStatus>("draft");
  const [summaries, setSummaries] = useState<RubricSummaryDTO[]>([]);
  const [answerText, setAnswerText] = useState("史实准确，观点明确，论证完整，结论清晰。");
  const [totalScore, setTotalScore] = useState("10");
  const [standardizedMarkdown, setStandardizedMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleList = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const items = await fetchRubricSummaries({ examId: examId.trim() || undefined });
      setSummaries(items);
      setSuccessMessage(`已加载 ${items.length} 条 Rubric 摘要`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取 Rubric 列表失败");
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = async (): Promise<void> => {
    const normalizedQuestionKey = questionKey.trim();
    if (!normalizedQuestionKey) {
      setErrorMessage("请先输入 questionKey");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const detail = await fetchRubricByQuestionKey(normalizedQuestionKey);
      if (!detail) {
        onRubricTextChange("");
        setSuccessMessage("未找到对应 Rubric");
        return;
      }

      onRubricTextChange(toPrettyString(detail.rubric));
      setLifecycleStatus(detail.lifecycleStatus);
      setSuccessMessage("Rubric 加载成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取 Rubric 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const result = await upsertRubric({
        questionKey: questionKey.trim() || undefined,
        rubric: parseRubricInput(rubricText),
        examId: examId.trim() || null,
        lifecycleStatus
      });

      onQuestionKeyChange(result.questionKey);
      onRubricTextChange(toPrettyString(result.rubric));
      setLifecycleStatus(result.lifecycleStatus);
      setSuccessMessage(`Rubric 保存成功：${result.questionKey}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存 Rubric 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    const normalizedQuestionKey = questionKey.trim();
    if (!normalizedQuestionKey) {
      setErrorMessage("请先输入 questionKey");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      await deleteRubricByQuestionKey(normalizedQuestionKey);
      onRubricTextChange("");
      setSuccessMessage("Rubric 删除成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除 Rubric 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!answerText.trim()) {
      setErrorMessage("请先输入参考答案文本");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const result = await generateRubric({
        answerText: answerText.trim(),
        questionId: questionKey.trim() || undefined,
        totalScore: parseScore(totalScore)
      });

      onRubricTextChange(toPrettyString(result.rubric));
      setSuccessMessage(`Rubric 生成完成（${result.provider}）`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成 Rubric 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleStandardize = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const payload = parseRubricInput(rubricText);
      const result = await standardizeRubric({
        rubric: typeof payload === "string" ? payload : (payload as Record<string, unknown>),
        maxScore: parseScore(totalScore)
      });

      setStandardizedMarkdown(result.rubric);
      setSuccessMessage(`标准化完成（${result.provider}）`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "标准化 Rubric 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleFillExampleRubric = (): void => {
    onRubricTextChange(EXAMPLE_RUBRIC);
    setSuccessMessage("已填充示例 Rubric");
    setErrorMessage(null);
  };

  const handleValidateRubric = (): void => {
    try {
      parseRubricInput(rubricText);
      setSuccessMessage("Rubric 格式校验通过");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rubric 格式校验失败");
    }
  };

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>Rubric</h2>
        <span className="hint">接口: /api/v2/rubrics*</span>
      </header>

      <div className="field-group">
        <label htmlFor="rubric-question-key">Question Key</label>
        <input
          id="rubric-question-key"
          type="text"
          value={questionKey}
          onChange={(event) => onQuestionKeyChange(event.target.value)}
          placeholder="Q1"
        />
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="rubric-exam-id">Exam ID（可选）</label>
          <input
            id="rubric-exam-id"
            type="text"
            value={examId}
            onChange={(event) => onExamIdChange(event.target.value)}
            placeholder="midterm-2026"
          />
        </div>

        <div className="field-group">
          <label htmlFor="rubric-status">Lifecycle</label>
          <select
            id="rubric-status"
            value={lifecycleStatus}
            onChange={(event) => setLifecycleStatus(event.target.value as RubricLifecycleStatus)}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void handleList()} disabled={busy}>
          列表
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleLoad()} disabled={busy}>
          加载
        </button>
        <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={busy}>
          保存
        </button>
        <button type="button" className="danger-btn" onClick={() => void handleDelete()} disabled={busy}>
          删除
        </button>
      </div>

      <div className="field-group">
        <label htmlFor="rubric-json">Rubric JSON / 文本</label>
        <textarea
          id="rubric-json"
          value={rubricText}
          onChange={(event) => onRubricTextChange(event.target.value)}
          rows={10}
          placeholder='例如: {"version":"2.0","answerPoints":[]}'
        />
      </div>

      <div className="field-group">
        <label htmlFor="rubric-answer-text">参考答案文本（用于生成）</label>
        <textarea
          id="rubric-answer-text"
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          rows={4}
        />
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="rubric-total-score">总分（生成/标准化）</label>
          <input
            id="rubric-total-score"
            type="number"
            min={1}
            value={totalScore}
            onChange={(event) => setTotalScore(event.target.value)}
          />
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={handleFillExampleRubric} disabled={busy}>
          填充示例
        </button>
        <button type="button" className="secondary-btn" onClick={handleValidateRubric} disabled={busy}>
          校验格式
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleGenerate()} disabled={busy}>
          生成草稿
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleStandardize()} disabled={busy}>
          标准化 Markdown
        </button>
      </div>

      {standardizedMarkdown ? (
        <div className="field-group">
          <label htmlFor="standardized-markdown">标准化结果</label>
          <textarea id="standardized-markdown" value={standardizedMarkdown} readOnly rows={8} />
        </div>
      ) : null}

      {summaries.length > 0 ? (
        <div className="status-box">
          <h3>Rubric 摘要列表</h3>
          <pre>{JSON.stringify(summaries, null, 2)}</pre>
        </div>
      ) : null}

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
