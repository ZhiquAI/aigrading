import type { ReactNode } from "react";
import type { RubricLifecycleStatus } from "../../../lib/api";
import { GearIcon } from "../../shared/icons";
import type { RubricResultPreview } from "../types";

type RubricResultViewProps = {
  statusMessage: ReactNode;
  resultPreview: RubricResultPreview;
  lifecycleStatus: RubricLifecycleStatus;
  busy: boolean;
  onBackInput: () => void;
  onOpenList: () => void;
  onOpenSettings?: () => void;
  onRegenerate: () => void;
  onSave: () => void;
};

export const RubricResultView = ({
  statusMessage,
  resultPreview,
  lifecycleStatus,
  busy,
  onBackInput,
  onOpenList,
  onOpenSettings,
  onRegenerate,
  onSave
}: RubricResultViewProps) => {
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
            <strong>{resultPreview.totalScore}</strong>
            <span>总分</span>
          </div>
        </div>
        <div className="legacy-rubric-result-tags">
          <span>评分策略：{resultPreview.strategyLabel}</span>
          <span>得分点：{resultPreview.points.length} 条</span>
          <span>发布状态：{lifecycleStatus === "published" ? "已发布" : "草稿"}</span>
        </div>
      </article>

      {resultPreview.points.length === 0 ? (
        <div className="legacy-rubric-empty">AI 暂未识别到得分点，请返回重生成。</div>
      ) : (
        <div className="legacy-rubric-result-list">
          {resultPreview.points.map((point, index) => (
            <article key={point.id} className="legacy-rubric-result-item">
              <div className="legacy-rubric-result-item-head">
                <span className="legacy-rubric-result-index">{index + 1}</span>
                <span className="legacy-rubric-result-segment">{point.questionSegment}</span>
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
      )}

      <div className="legacy-rubric-result-note">请核对识别内容与分值分配，确认后保存到细则库。</div>

      <div className="legacy-rubric-bottom-bar">
        <button type="button" className="secondary" onClick={onRegenerate} disabled={busy}>
          返回重生成
        </button>
        <button type="button" className="primary" onClick={onSave} disabled={busy}>
          {busy ? "保存中..." : "保存备用"}
        </button>
      </div>
    </section>
  );
};
