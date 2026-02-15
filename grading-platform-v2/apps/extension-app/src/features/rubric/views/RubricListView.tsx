import type { ReactNode } from "react";
import { Badge, Button, EmptyState } from "@ai-grading/ui-kit";
import type { RubricSummaryDTO } from "../../../lib/api";

type RubricListViewProps = {
  statusMessage: ReactNode;
  examId: string;
  loadingList: boolean;
  summaries: RubricSummaryDTO[];
  onBack: () => void;
  onRefresh: () => void;
  onLoad: (questionKey: string) => void;
  onExamIdChange: (value: string) => void;
  formatSummarySubline: (item: RubricSummaryDTO) => string;
};

export const RubricListView = ({
  statusMessage,
  examId,
  loadingList,
  summaries,
  onBack,
  onRefresh,
  onLoad,
  onExamIdChange,
  formatSummarySubline
}: RubricListViewProps) => {
  return (
    <section className="classic-rubric-workspace">
      <header className="classic-rubric-subheader">
        <Button type="button" variant="unstyled" onClick={onBack}>
          ←
        </Button>
        <h3>评分细则列表</h3>
        <Button type="button" variant="unstyled" onClick={onRefresh} disabled={loadingList}>
          刷新
        </Button>
      </header>

      {statusMessage}

      <div className="classic-rubric-toolbar">
        <input
          type="text"
          value={examId}
          onChange={(event) => onExamIdChange(event.target.value)}
          placeholder="按考试 ID 筛选（可选）"
        />
        <Button type="button" variant="unstyled" onClick={onRefresh} disabled={loadingList}>
          {loadingList ? "加载中..." : "加载"}
        </Button>
      </div>

      {summaries.length === 0 ? (
        <EmptyState title="暂无匹配细则" description="可尝试切换考试 ID 或点击刷新重新拉取。" className="classic-rubric-empty" />
      ) : (
        <ul className="classic-rubric-list">
          {summaries.map((item) => (
            <li key={item.questionId}>
              <Button type="button" variant="unstyled" onClick={() => onLoad(item.questionId)}>
                <div>
                  <strong>{item.title || item.questionId}</strong>
                  <span>{formatSummarySubline(item)}</span>
                </div>
                <Badge
                  variant={item.lifecycleStatus === "published" ? "success" : "gray"}
                  size="sm"
                  className="classic-rubric-lifecycle-badge"
                >
                  {item.lifecycleStatus === "published" ? "已发布" : "草稿"}
                </Badge>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
