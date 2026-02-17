import { parseKeywordInput } from "../utils/rubric-parser";
import { MATCH_MODE_HINT, STRATEGY_VISUAL } from "../utils/rubric-visual-constants";
import type {
  RubricMatrixDimensionPreview,
  RubricMatrixLevelPreview,
  RubricResultPoint,
  SegmentPreview
} from "../types";

type SegmentCardListProps = {
  segments: SegmentPreview[];
  busy: boolean;
  onSegmentTitleChange: (segmentId: string, title: string) => void;
  onPointChange: (segmentId: string, pointId: string, patch: Partial<RubricResultPoint>) => void;
  onDimensionChange: (segmentId: string, dimensionId: string, patch: Partial<RubricMatrixDimensionPreview>) => void;
  onDimensionLevelChange: (
    segmentId: string,
    dimensionId: string,
    levelIndex: number,
    patch: Partial<RubricMatrixLevelPreview>
  ) => void;
};

const STRATEGY_ICON: Record<string, string> = {
  point_accumulation: "📍",
  sequential_logic: "🔢",
  rubric_matrix: "📊"
};

export const SegmentCardList = ({
  segments,
  busy,
  onSegmentTitleChange,
  onPointChange,
  onDimensionChange,
  onDimensionLevelChange
}: SegmentCardListProps) => {
  if (segments.length === 0) {
    return <div className="classic-rubric-empty">AI 暂未识别到得分点，请返回重生成。</div>;
  }

  return (
    <div className="classic-rubric-segment-list">
      {segments.map((segment, segmentIndex) => (
        <section
          key={segment.id}
          className="classic-rubric-segment-card"
          data-strategy={segment.strategyType}
        >
          <header className="classic-rubric-segment-head">
            <span className="classic-rubric-segment-index">{segmentIndex + 1}</span>
            <input
              className="classic-rubric-segment-title"
              value={segment.title}
              onChange={(event) => onSegmentTitleChange(segment.id, event.target.value)}
              disabled={busy}
            />
            <span
              className="classic-rubric-strategy-badge strategy-badge"
              data-type={segment.strategyType}
              data-strategy={segment.strategyType}
              title={STRATEGY_VISUAL[segment.strategyType]?.hint}
            >
              <span className="strategy-badge-icon" aria-hidden>{STRATEGY_ICON[segment.strategyType] ?? "🏷️"}</span>
              <span>{segment.strategyLabel}</span>
            </span>
            {segment.matchingMode ? (
              <span
                className="classic-rubric-match-hint"
                title={MATCH_MODE_HINT[segment.matchingMode]}
              >
                {segment.matchingMode === "strict" ? "精确" : segment.matchingMode === "semantic" ? "语义" : segment.matchingMode}
              </span>
            ) : null}
            <span className="classic-rubric-segment-score">
              {segment.strategyType === "rubric_matrix"
                ? `${segment.dimensions.length} 维度`
                : `${segment.points.reduce((sum, point) => sum + point.score, 0)} 分`}
            </span>
          </header>

          {segment.strategyType === "rubric_matrix" ? (
            <div className="classic-rubric-matrix-table">
              {segment.dimensions.length === 0 ? (
                <div className="classic-rubric-empty">未识别到维度矩阵，请返回重生成。</div>
              ) : null}
              {segment.dimensions.map((dimension, dimensionIndex) => (
                <article key={dimension.id} className="classic-rubric-matrix-row">
                  <div className="classic-rubric-matrix-row-head">
                    <span className="classic-rubric-result-table-index">{dimensionIndex + 1}</span>
                    <input
                      value={dimension.name}
                      onChange={(event) => onDimensionChange(segment.id, dimension.id, { name: event.target.value })}
                      disabled={busy}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={dimension.weight}
                      onChange={(event) => onDimensionChange(segment.id, dimension.id, { weight: Number(event.target.value) || 0 })}
                      disabled={busy}
                    />
                  </div>
                  <div className="classic-rubric-matrix-level-list">
                    {dimension.levels.map((level, levelIndex) => (
                      <div key={`${dimension.id}-level-${levelIndex}`} className="classic-rubric-matrix-level-item">
                        <input
                          value={level.label}
                          onChange={(event) => onDimensionLevelChange(segment.id, dimension.id, levelIndex, { label: event.target.value })}
                          disabled={busy}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={level.score}
                          onChange={(event) => onDimensionLevelChange(segment.id, dimension.id, levelIndex, { score: Number(event.target.value) || 0 })}
                          disabled={busy}
                        />
                        <input
                          value={level.description}
                          onChange={(event) => onDimensionLevelChange(segment.id, dimension.id, levelIndex, { description: event.target.value })}
                          placeholder="等级说明"
                          disabled={busy}
                        />
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="classic-rubric-result-table">
              <header className="classic-rubric-result-table-head">
                <span>#</span>
                <span>问题词</span>
                <span>得分点</span>
                <span>分值</span>
                <span>关键词</span>
              </header>
              <div className="classic-rubric-result-table-body">
                {segment.points.map((point, pointIndex) => (
                  <article key={point.id} className="classic-rubric-result-table-row">
                    <span className="classic-rubric-result-table-index">{pointIndex + 1}</span>
                    <input
                      value={point.questionSegment}
                      onChange={(event) => onPointChange(segment.id, point.id, { questionSegment: event.target.value })}
                      placeholder="可空"
                      disabled={busy}
                    />
                    <textarea
                      rows={2}
                      value={point.content}
                      onChange={(event) => onPointChange(segment.id, point.id, { content: event.target.value })}
                      placeholder="输入得分点"
                      disabled={busy}
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={point.score}
                      onChange={(event) => onPointChange(segment.id, point.id, { score: Number(event.target.value) || 0 })}
                      disabled={busy}
                    />
                    <input
                      value={point.keywords.join("，")}
                      onChange={(event) => onPointChange(segment.id, point.id, { keywords: parseKeywordInput(event.target.value) })}
                      placeholder="关键词1，关键词2"
                      disabled={busy}
                    />
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
};
