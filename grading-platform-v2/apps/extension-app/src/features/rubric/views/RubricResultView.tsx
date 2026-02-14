import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { RubricLifecycleStatus } from "../../../lib/api";
import { GearIcon } from "../../shared/icons";
import type { RubricResultPreview } from "../types";

type RubricResultViewProps = {
  statusMessage: ReactNode;
  rubricText: string;
  resultPreview: RubricResultPreview;
  lifecycleStatus: RubricLifecycleStatus;
  busy: boolean;
  onBackInput: () => void;
  onOpenList: () => void;
  onOpenSettings?: () => void;
  onRegenerate: () => void;
  onRubricTextChange: (value: string) => void;
  onSave: (nextRubricText?: string) => void;
};

type PointSourceMode = "answerPoints" | "content.points" | "content.steps" | "none";

type EditablePointRow = {
  id: string;
  questionSegment: string;
  content: string;
  score: number;
  keywords: string[];
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const normalizeRow = (
  point: Record<string, unknown>,
  index: number,
  segmentLabel?: string
): EditablePointRow | null => {
  const content = firstText(point.content, point.standard, point.name);
  if (!content) {
    return null;
  }

  const score = Number(point.score);
  const keywords = Array.isArray(point.keywords)
    ? point.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id: firstText(point.id) || `p-${index + 1}`,
    questionSegment: firstText(point.questionSegment, segmentLabel),
    content,
    score: Number.isFinite(score) ? score : 0,
    keywords
  };
};

const parseKeywordInput = (value: string): string[] => {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toPointPayload = (row: EditablePointRow): Record<string, unknown> => {
  return {
    id: row.id,
    questionSegment: row.questionSegment.trim() || undefined,
    content: row.content.trim(),
    score: Number.isFinite(row.score) ? row.score : 0,
    keywords: row.keywords
  };
};

export const RubricResultView = ({
  statusMessage,
  rubricText,
  resultPreview,
  lifecycleStatus,
  busy,
  onBackInput,
  onOpenList,
  onOpenSettings,
  onRegenerate,
  onRubricTextChange,
  onSave
}: RubricResultViewProps) => {
  const parsedRubric = useMemo<Record<string, unknown> | null>(() => {
    const trimmed = rubricText.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return toRecord(parsed);
    } catch {
      return null;
    }
  }, [rubricText]);

  const {
    initialRows,
    sourceMode,
    readOnlyReason
  } = useMemo(() => {
    if (!parsedRubric) {
      const fallbackRows = resultPreview.points.map((point) => ({
        id: point.id,
        questionSegment: point.questionSegment,
        content: point.content,
        score: point.score,
        keywords: point.keywords
      }));

      return {
        initialRows: fallbackRows,
        sourceMode: "none" as PointSourceMode,
        readOnlyReason: ""
      };
    }

    const content = toRecord(parsedRubric.content) ?? {};
    const segments = toRecordList(content.segments);
    if (segments.length > 0) {
      const rows = segments.flatMap((segment) => {
        const segmentLabel = firstText(segment.title, segment.name, segment.segment, segment.id);
        const segmentContent = toRecord(segment.content) ?? {};
        const segmentPoints = [
          ...toRecordList(segment.points),
          ...toRecordList(segmentContent.points),
          ...toRecordList(segmentContent.steps)
        ];
        return segmentPoints
          .map((point, index) => normalizeRow(point, index, segmentLabel))
          .filter((item): item is EditablePointRow => Boolean(item));
      });

      return {
        initialRows: rows,
        sourceMode: "none" as PointSourceMode,
        readOnlyReason: "当前细则包含多小问分段结构，为避免破坏结构，本页仅展示 AI 结果，可直接保存。"
      };
    }

    const answerPoints = toRecordList(parsedRubric.answerPoints);
    if (answerPoints.length > 0) {
      return {
        initialRows: answerPoints
          .map((point, index) => normalizeRow(point, index))
          .filter((item): item is EditablePointRow => Boolean(item)),
        sourceMode: "answerPoints" as PointSourceMode,
        readOnlyReason: ""
      };
    }

    const contentPoints = toRecordList(content.points);
    if (contentPoints.length > 0) {
      return {
        initialRows: contentPoints
          .map((point, index) => normalizeRow(point, index))
          .filter((item): item is EditablePointRow => Boolean(item)),
        sourceMode: "content.points" as PointSourceMode,
        readOnlyReason: ""
      };
    }

    const contentSteps = toRecordList(content.steps);
    if (contentSteps.length > 0) {
      return {
        initialRows: contentSteps
          .map((point, index) => normalizeRow(point, index))
          .filter((item): item is EditablePointRow => Boolean(item)),
        sourceMode: "content.steps" as PointSourceMode,
        readOnlyReason: ""
      };
    }

    return {
      initialRows: resultPreview.points.map((point) => ({
        id: point.id,
        questionSegment: point.questionSegment,
        content: point.content,
        score: point.score,
        keywords: point.keywords
      })),
      sourceMode: "none" as PointSourceMode,
      readOnlyReason: ""
    };
  }, [parsedRubric, resultPreview.points]);

  const [rows, setRows] = useState<EditablePointRow[]>(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const computedTotalScore = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.score) ? row.score : 0), 0);
    return total > 0 ? total : resultPreview.totalScore;
  }, [resultPreview.totalScore, rows]);

  const handleRowChange = (rowId: string, patch: Partial<EditablePointRow>): void => {
    if (readOnlyReason) {
      return;
    }

    setRows((previous) => previous.map((row) => (
      row.id === rowId ? { ...row, ...patch } : row
    )));
  };

  const handleSaveClick = (): void => {
    if (readOnlyReason || !parsedRubric) {
      onSave();
      return;
    }

    const nextRoot = JSON.parse(JSON.stringify(parsedRubric)) as Record<string, unknown>;
    const nextRows = rows.map(toPointPayload);
    const nextContent = toRecord(nextRoot.content) ?? {};

    if (sourceMode === "answerPoints") {
      nextRoot.answerPoints = nextRows;
    } else if (sourceMode === "content.points") {
      nextContent.points = nextRows;
      nextRoot.content = nextContent;
    } else if (sourceMode === "content.steps") {
      nextContent.steps = nextRows;
      nextRoot.content = nextContent;
    } else {
      nextContent.points = nextRows;
      nextRoot.content = nextContent;
    }

    const nextTotal = rows.reduce((sum, row) => sum + (Number.isFinite(row.score) ? row.score : 0), 0);
    if (nextTotal > 0) {
      const metadata = toRecord(nextRoot.metadata) ?? {};
      metadata.totalScore = nextTotal;
      nextRoot.metadata = metadata;
      nextRoot.totalScore = nextTotal;
    }

    const nextRubricText = JSON.stringify(nextRoot, null, 2);
    onRubricTextChange(nextRubricText);
    onSave(nextRubricText);
  };

  return (
    <section className="legacy-rubric-workspace">
      <header className="legacy-rubric-subheader">
        <button type="button" onClick={onBackInput}>←</button>
        <h3>生成结果</h3>
        <div className="legacy-rubric-subheader-actions">
          <button type="button" className="legacy-rubric-subheader-link" onClick={onOpenList}>模板</button>
          <button
            type="button"
            className="legacy-rubric-settings-btn"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            <GearIcon className="legacy-gear-icon" />
          </button>
        </div>
      </header>

      {statusMessage}

      <article className="legacy-rubric-result-summary">
        <div className="legacy-rubric-result-main">
          <div>
            <p className="legacy-rubric-result-label">AI 已自动拆分并填充</p>
            <h4>{resultPreview.title}</h4>
            <p className="legacy-rubric-result-meta">
              题号 {resultPreview.questionId} · {resultPreview.subject} · {resultPreview.questionType}
            </p>
          </div>
          <div className="legacy-rubric-result-score">
            <strong>{computedTotalScore}</strong>
            <span>总分</span>
          </div>
        </div>
        <div className="legacy-rubric-result-tags">
          <span>评分策略：{resultPreview.strategyLabel}</span>
          <span>得分点：{rows.length} 条</span>
          <span>发布状态：{lifecycleStatus === "published" ? "已发布" : "草稿"}</span>
        </div>
        {readOnlyReason ? (
          <p className="legacy-rubric-result-readonly">{readOnlyReason}</p>
        ) : (
          <p className="legacy-rubric-result-readonly">可编辑：问题词、得分点、分值、关键词。</p>
        )}
      </article>

      {rows.length === 0 ? (
        <div className="legacy-rubric-empty">AI 暂未识别到得分点，请返回重生成。</div>
      ) : readOnlyReason ? (
        <div className="legacy-rubric-result-list">
          {rows.map((point, index) => (
            <article key={point.id} className="legacy-rubric-result-item">
              <div className="legacy-rubric-result-item-head">
                <span className="legacy-rubric-result-index">{index + 1}</span>
                <span className="legacy-rubric-result-segment">{point.questionSegment || "得分点"}</span>
                <span className="legacy-rubric-result-point">{point.score}分</span>
              </div>
              <p>{point.content}</p>
              {point.keywords.length > 0 ? (
                <div className="legacy-rubric-result-keywords">
                  {point.keywords.map((keyword) => (
                    <span key={`${point.id}-${keyword}`}>{keyword}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <section className="legacy-rubric-result-table">
          <header className="legacy-rubric-result-table-head">
            <span>#</span>
            <span>问题词</span>
            <span>得分点</span>
            <span>分值</span>
            <span>关键词</span>
          </header>
          <div className="legacy-rubric-result-table-body">
            {rows.map((row, index) => (
              <article key={row.id} className="legacy-rubric-result-table-row">
                <span className="legacy-rubric-result-table-index">{index + 1}</span>
                <input
                  value={row.questionSegment}
                  onChange={(event) => handleRowChange(row.id, { questionSegment: event.target.value })}
                  placeholder="可空"
                />
                <textarea
                  rows={2}
                  value={row.content}
                  onChange={(event) => handleRowChange(row.id, { content: event.target.value })}
                  placeholder="输入得分点"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.score}
                  onChange={(event) => handleRowChange(row.id, { score: Number(event.target.value) || 0 })}
                />
                <input
                  value={row.keywords.join("，")}
                  onChange={(event) => handleRowChange(row.id, { keywords: parseKeywordInput(event.target.value) })}
                  placeholder="关键词1，关键词2"
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="legacy-rubric-result-note">请核对识别内容与分值分配，确认后保存到细则库。</div>

      <div className="legacy-rubric-bottom-bar">
        <button type="button" className="secondary" onClick={onRegenerate} disabled={busy}>
          返回重生成
        </button>
        <button type="button" className="primary" onClick={handleSaveClick} disabled={busy}>
          {busy ? "保存中..." : "保存备用"}
        </button>
      </div>
    </section>
  );
};
