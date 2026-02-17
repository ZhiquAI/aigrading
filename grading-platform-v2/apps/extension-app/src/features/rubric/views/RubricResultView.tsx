import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { RubricLifecycleStatus } from "../../../lib/api";
import { GearIcon } from "../../shared/icons";
import type { RubricResultPoint, RubricResultPreview, SegmentPreview } from "../types";
import { firstText, toRecord, toRecordList } from "../utils/rubric-parser";
import { SegmentCardList } from "./SegmentCardList";

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

const toPointPayload = (row: RubricResultPoint): Record<string, unknown> => {
  return {
    id: row.id,
    questionSegment: row.questionSegment.trim() || undefined,
    content: row.content.trim(),
    score: Number.isFinite(row.score) ? row.score : 0,
    keywords: row.keywords
  };
};

const toDimensionPayload = (dimension: SegmentPreview["dimensions"][number]): Record<string, unknown> => {
  return {
    id: dimension.id,
    name: dimension.name.trim(),
    weight: Number.isFinite(dimension.weight) ? dimension.weight : 1,
    levels: dimension.levels.map((level) => ({
      label: level.label.trim(),
      score: Number.isFinite(level.score) ? level.score : 0,
      description: level.description.trim() || undefined
    }))
  };
};

const buildConstraintLabel = (type: string): string => {
  if (type === "deduction_fixed") {
    return "固定扣分";
  }
  if (type === "deduction_per_count") {
    return "按次数扣分";
  }
  if (type === "score_cap") {
    return "分数封顶";
  }
  if (type === "logic_check") {
    return "逻辑校验";
  }
  return type;
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

  const [segments, setSegments] = useState<SegmentPreview[]>(resultPreview.segments);

  useEffect(() => {
    setSegments(resultPreview.segments);
  }, [resultPreview.segments]);

  const computedTotalScore = useMemo(() => {
    const total = segments.reduce((segmentSum, segment) => {
      if (segment.strategyType === "rubric_matrix") {
        const matrixScore = segment.dimensions.reduce((dimensionSum, dimension) => {
          const maxLevelScore = dimension.levels.reduce((levelMax, level) => {
            return Math.max(levelMax, Number.isFinite(level.score) ? level.score : 0);
          }, 0);
          const weight = Number.isFinite(dimension.weight) ? dimension.weight : 1;
          return dimensionSum + (maxLevelScore * weight);
        }, 0);
        return segmentSum + (segment.maxScore > 0 ? segment.maxScore : matrixScore);
      }

      return segmentSum + segment.points.reduce((pointSum, point) => pointSum + (Number.isFinite(point.score) ? point.score : 0), 0);
    }, 0);
    return total > 0 ? total : resultPreview.totalScore;
  }, [resultPreview.totalScore, segments]);

  const handleSegmentTitleChange = (segmentId: string, title: string): void => {
    setSegments((previous) => previous.map((segment) => {
      return segment.id === segmentId
        ? { ...segment, title }
        : segment;
    }));
  };

  const handlePointChange = (segmentId: string, pointId: string, patch: Partial<RubricResultPoint>): void => {
    setSegments((previous) => previous.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      return {
        ...segment,
        points: segment.points.map((point) => (
          point.id === pointId ? { ...point, ...patch } : point
        ))
      };
    }));
  };

  const handleDimensionChange = (
    segmentId: string,
    dimensionId: string,
    patch: Partial<SegmentPreview["dimensions"][number]>
  ): void => {
    setSegments((previous) => previous.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      return {
        ...segment,
        dimensions: segment.dimensions.map((dimension) => {
          return dimension.id === dimensionId
            ? { ...dimension, ...patch }
            : dimension;
        })
      };
    }));
  };

  const handleDimensionLevelChange = (
    segmentId: string,
    dimensionId: string,
    levelIndex: number,
    patch: Partial<SegmentPreview["dimensions"][number]["levels"][number]>
  ): void => {
    setSegments((previous) => previous.map((segment) => {
      if (segment.id !== segmentId) {
        return segment;
      }

      return {
        ...segment,
        dimensions: segment.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) {
            return dimension;
          }

          return {
            ...dimension,
            levels: dimension.levels.map((level, currentIndex) => {
              return currentIndex === levelIndex ? { ...level, ...patch } : level;
            })
          };
        })
      };
    }));
  };

  const handleSaveClick = (): void => {
    if (!parsedRubric) {
      onSave();
      return;
    }

    const nextRoot = JSON.parse(JSON.stringify(parsedRubric)) as Record<string, unknown>;
    const nextContent = toRecord(nextRoot.content) ?? {};
    const rootSegments = toRecordList(nextRoot.segments);
    const contentSegments = toRecordList(nextContent.segments);

    if (rootSegments.length > 0 || contentSegments.length > 0) {
      const baseSegments = rootSegments.length > 0 ? rootSegments : contentSegments;

      const nextSegments = segments.map((segment, index) => {
        const baseSegment = baseSegments[index] ?? {};
        const strategyType = firstText(baseSegment.strategyType) || segment.strategyType;
        const hasTopLevelPoints = Array.isArray(baseSegment.points);
        const nextPoints = segment.points.map(toPointPayload);
        const nextDimensions = segment.dimensions.map(toDimensionPayload);
        const nextSegmentContent = toRecord(baseSegment.content) ?? {};

        if (strategyType === "sequential_logic") {
          nextSegmentContent.steps = nextPoints.map((point, stepIndex) => ({
            ...point,
            order: stepIndex + 1
          }));
          delete nextSegmentContent.points;
        } else if (strategyType === "rubric_matrix") {
          nextSegmentContent.dimensions = nextDimensions;
          delete nextSegmentContent.points;
          delete nextSegmentContent.steps;
        } else {
          nextSegmentContent.points = nextPoints;
          delete nextSegmentContent.steps;
        }

        const segmentScore = strategyType === "rubric_matrix"
          ? (
            Number(baseSegment.maxScore)
            || Number(nextSegmentContent.totalScore)
            || segment.maxScore
          )
          : segment.points.reduce((sum, point) => sum + point.score, 0);

        return {
          ...baseSegment,
          id: segment.id,
          title: segment.title,
          segment: segment.title,
          strategyType,
          maxScore: Number.isFinite(segmentScore) ? segmentScore : 0,
          points: hasTopLevelPoints ? nextPoints : undefined,
          content: nextSegmentContent
        };
      });

      if (rootSegments.length > 0) {
        nextRoot.segments = nextSegments;
      } else {
        nextContent.segments = nextSegments;
        nextRoot.content = nextContent;
      }
    } else {
      const fallbackPoints = (segments[0]?.points ?? []).map(toPointPayload);
      const hasAnswerPoints = Array.isArray(nextRoot.answerPoints);
      const hasSteps = Array.isArray(nextContent.steps);

      if (hasAnswerPoints) {
        nextRoot.answerPoints = fallbackPoints;
      } else if (hasSteps) {
        nextContent.steps = fallbackPoints;
        nextRoot.content = nextContent;
      } else {
        nextContent.points = fallbackPoints;
        nextRoot.content = nextContent;
      }
    }

    const nextTotal = computedTotalScore;
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
    <section className="classic-rubric-workspace">
      <header className="classic-rubric-subheader">
        <button type="button" onClick={onBackInput}>←</button>
        <h3>生成结果</h3>
        <div className="classic-rubric-subheader-actions">
          <button type="button" className="classic-rubric-subheader-link" onClick={onOpenList}>模板</button>
          <button
            type="button"
            className="classic-rubric-settings-btn"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            <GearIcon className="classic-gear-icon" />
          </button>
        </div>
      </header>

      {statusMessage}

      <article className="classic-rubric-result-summary">
        <div className="classic-rubric-result-main">
          <div>
            <p className="classic-rubric-result-label">AI 已自动拆分并填充</p>
            <h4>{resultPreview.title}</h4>
            <p className="classic-rubric-result-meta">
              题号 {resultPreview.questionId} · {resultPreview.subject} · {resultPreview.questionType}
            </p>
          </div>
          <div className="classic-rubric-result-score">
            <strong>{computedTotalScore}</strong>
            <span>总分</span>
          </div>
        </div>
        <div className="classic-rubric-result-tags">
          <span>评分策略：{resultPreview.strategyLabel}</span>
          <span>题段：{segments.length} 段</span>
          <span>得分点：{segments.reduce((sum, segment) => sum + segment.points.length, 0)} 条</span>
          <span>聚合：{resultPreview.segmentAggregation}</span>
          <span>发布状态：{lifecycleStatus === "published" ? "已发布" : "草稿"}</span>
        </div>
        <p className="classic-rubric-result-readonly">可编辑：题段标题、问题词、得分点、分值、关键词。</p>

        {resultPreview.globalPolicy ? (
          <div className="classic-rubric-result-policy">
            <span>冲突策略：{resultPreview.globalPolicy.conflictPolicy}</span>
            <span>最低置信度：{resultPreview.globalPolicy.minConfidence}</span>
            <span>OCR 容忍度：{resultPreview.globalPolicy.ocrTolerance}</span>
          </div>
        ) : null}

        {resultPreview.constraints.length > 0 ? (
          <div className="classic-rubric-result-constraints">
            {resultPreview.constraints.map((constraint) => (
              <span key={constraint.id} className="classic-rubric-result-constraint-tag">
                {buildConstraintLabel(constraint.type)}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      <SegmentCardList
        segments={segments}
        busy={busy}
        onSegmentTitleChange={handleSegmentTitleChange}
        onPointChange={handlePointChange}
        onDimensionChange={handleDimensionChange}
        onDimensionLevelChange={handleDimensionLevelChange}
      />

      <div className="classic-rubric-result-note">请核对识别内容与分值分配，确认后保存到细则库。</div>

      <div className="classic-rubric-bottom-bar">
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
