import type { ChangeEvent, ReactNode, RefObject } from "react";
import { Badge, Button, Card, EmptyState } from "@ai-grading/ui-kit";
import type { RubricSummaryDTO } from "../../../lib/api";

type RubricWelcomeViewProps = {
  statusMessage: ReactNode;
  summaries: RubricSummaryDTO[];
  importInputRef: RefObject<HTMLInputElement>;
  onStart: () => void;
  onImport: () => void;
  onEnterList: () => void;
  onLoad: (questionKey: string) => void;
  onImportJson: (event: ChangeEvent<HTMLInputElement>) => void;
  formatSummarySubline: (item: RubricSummaryDTO) => string;
};

export const RubricWelcomeView = ({
  statusMessage,
  summaries,
  importInputRef,
  onStart,
  onImport,
  onEnterList,
  onLoad,
  onImportJson,
  formatSummarySubline
}: RubricWelcomeViewProps) => {
  return (
    <section className="classic-rubric-workspace">
      {statusMessage}

      <Button type="button" variant="unstyled" className="classic-rubric-hero" onClick={onStart}>
        <div className="classic-rubric-hero-head">
          <span className="classic-rubric-hero-icon">✦</span>
          <Badge variant="blue" className="classic-rubric-hero-chip">
            AI 驱动
          </Badge>
        </div>
        <h3>智能创建细则</h3>
        <p>输入题号、答案文本与总分，自动生成可保存评分细则。</p>
        <div className="classic-rubric-hero-cta">立即开始</div>
      </Button>

      <div className="classic-rubric-shortcuts">
        <Button
          type="button"
          variant="unstyled"
          className="classic-rubric-shortcut"
          onClick={onImport}
        >
          <span className="classic-rubric-shortcut-icon">↧</span>
          <strong>导入细则</strong>
          <span>支持 JSON 文件继续编辑</span>
        </Button>

        <Button type="button" variant="unstyled" className="classic-rubric-shortcut" onClick={onEnterList}>
          <span className="classic-rubric-shortcut-icon">◫</span>
          <strong>模板库</strong>
          <span>{summaries.length > 0 ? `已有 ${summaries.length} 条` : "常用标准合集"}</span>
        </Button>
      </div>

      <Card variant="unstyled" className="classic-rubric-recent">
        <div className="classic-rubric-recent-head">
          <span>最近细则</span>
          <Badge variant="blue" size="sm" className="classic-rubric-count">
            {summaries.length}
          </Badge>
        </div>

        {summaries.length === 0 ? (
          <EmptyState
            title="暂无评分细则"
            description="先创建或导入一个细则开始使用。"
            className="classic-rubric-empty"
          />
        ) : (
          <div className="classic-rubric-recent-list">
            {summaries.slice(0, 2).map((item) => (
              <Button
                type="button"
                variant="unstyled"
                key={item.questionId}
                className="classic-rubric-recent-item"
                onClick={() => onLoad(item.questionId)}
              >
                <div>
                  <strong>{item.title || item.questionId}</strong>
                  <span>{formatSummarySubline(item)}</span>
                </div>
                <em>{item.questionId}</em>
              </Button>
            ))}
          </div>
        )}
      </Card>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="classic-hidden-input"
        onChange={onImportJson}
      />
    </section>
  );
};
