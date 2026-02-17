import * as React from "react";
import { cn } from "../../lib/utils";
import { GradingSegmentSection } from "./GradingSegmentSection";
import type { GradingResultViewModel } from "./types";

export type GradingScoreCardProps = {
  result: GradingResultViewModel;
  className?: string;
  showActions?: boolean;
  onApply?: (nextResult: GradingResultViewModel) => void;
  onItemChange?: (itemId: string, newScore: number) => void;
  onCommentChange?: (comment: string) => void;
  defaultExpanded?: boolean;
};

type FlatBreakdownItem = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  comment?: string;
};

const formatPercent = (score: number, maxScore: number): number => {
  if (maxScore <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
};

const flattenSegments = (result: GradingResultViewModel): FlatBreakdownItem[] => {
  const rows: FlatBreakdownItem[] = [];

  for (const segment of result.segments) {
    for (const item of segment.items) {
      if (item.type === "dimension") {
        rows.push({
          id: `${segment.segmentId}-${item.dimensionId}`,
          label: `${item.dimensionName}: ${item.selectedLevel}`,
          score: item.score,
          maxScore: item.maxScore,
          comment: item.comment
        });
        continue;
      }

      if (item.type === "step") {
        rows.push({
          id: `${segment.segmentId}-${item.stepId}`,
          label: item.label,
          score: item.score,
          maxScore: item.maxScore,
          comment: item.comment
        });
        continue;
      }

      rows.push({
        id: `${segment.segmentId}-${item.pointId}`,
        label: item.label,
        score: item.score,
        maxScore: item.maxScore,
        comment: item.comment
      });
    }
  }

  return rows;
};

export const GradingScoreCard = ({
  result,
  className,
  showActions = true,
  onApply,
  onItemChange,
  onCommentChange,
  defaultExpanded = true
}: GradingScoreCardProps) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [draftComment, setDraftComment] = React.useState(result.comment);
  const flatItems = React.useMemo(() => flattenSegments(result), [result]);
  const progress = formatPercent(result.score, result.maxScore);
  const hasSegments = result.segments.length > 0;

  React.useEffect(() => {
    setDraftComment(result.comment);
  }, [result.comment]);

  return (
    <article className={cn("ag-grading-score-card", className)}>
      <header className="ag-grading-score-header">
        <div>
          <h3>{result.studentName}</h3>
          <p>{result.questionNo || result.questionKey}</p>
        </div>
        <strong>{`${result.score} / ${result.maxScore}`}</strong>
      </header>

      <div className="ag-grading-progress">
        <div className="ag-grading-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <label className="ag-grading-comment">
        <span>评语</span>
        <textarea
          value={draftComment}
          onChange={(event) => {
            const next = event.target.value;
            setDraftComment(next);
            onCommentChange?.(next);
          }}
          rows={2}
        />
      </label>

      <button type="button" className="ag-grading-toggle" onClick={() => setExpanded((current) => !current)}>
        {expanded ? "收起评分细项" : "展开评分细项"}
      </button>

      {expanded ? (
        <div className="ag-grading-segment-list">
          {hasSegments ? (
            result.segments.map((segment) => <GradingSegmentSection key={segment.segmentId} segment={segment} />)
          ) : (
            <div className="ag-grading-flat-list">
              {flatItems.map((item, index) => (
                <article key={`${item.id}-${index}`} className="ag-grading-item">
                  <div className="ag-grading-item-head">
                    <span>{item.label}</span>
                    <span>{`${item.score} / ${item.maxScore}`}</span>
                  </div>
                  {item.comment ? <p>{item.comment}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showActions ? (
        <div className="ag-grading-actions">
          <button
            type="button"
            className="ag-grading-action-primary"
            onClick={() => {
              onApply?.({
                ...result,
                comment: draftComment
              });
            }}
          >
            确认回填
          </button>
          {flatItems.length > 0 ? (
            <button
              type="button"
              className="ag-grading-action-ghost"
              onClick={() => onItemChange?.(flatItems[0]?.label ?? "unknown", flatItems[0]?.score ?? 0)}
            >
              逐项校正（占位）
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
