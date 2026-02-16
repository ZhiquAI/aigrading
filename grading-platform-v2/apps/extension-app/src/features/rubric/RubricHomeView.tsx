import { useCallback, useEffect, useMemo, useState } from "react";
import type { RubricEntryIntent } from "../../store/useRootStore";
import { fetchRubricSummaries, type RubricSummaryDTO } from "../../lib/api";
import { Badge, Button, Card } from "@ai-grading/ui-kit";
import { GearIcon, WandIcon } from "../shared/icons";

type RubricHomeViewProps = {
  onOpenSettings: () => void;
  onOpenRubricWorkspace: (intent: RubricEntryIntent) => void;
};

const formatSummarySubline = (item: RubricSummaryDTO): string => {
  const left = item.pointCount > 0 ? `${item.pointCount} 点` : "暂无要点";
  const right = item.totalScore > 0 ? `${item.totalScore} 分` : "未设分值";
  return `${left} · ${right}`;
};

const formatDateLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
};

export const RubricHomeView = ({
  onOpenSettings,
  onOpenRubricWorkspace
}: RubricHomeViewProps) => {
  const [summaries, setSummaries] = useState<RubricSummaryDTO[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummaries = useCallback(async (): Promise<void> => {
    setLoadingList(true);
    setLoadError(null);

    try {
      const items = await fetchRubricSummaries();
      setSummaries(items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "读取评分细则失败");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const listCountLabel = useMemo(() => String(summaries.length), [summaries.length]);

  return (
    <>
      <header className="rubric-home-header classic-rubric-header">
        <div className="rubric-home-title-wrap classic-rubric-title-wrap">
          <span className="rubric-home-ai-pill classic-rubric-ai-pill">AI</span>
          <h1>智能阅卷</h1>
        </div>

        <div className="rubric-home-actions classic-header-actions">
          <Badge variant="warning" className="app-trial-chip classic-trial-chip">
            试用版
          </Badge>
          <Button
            type="button"
            variant="unstyled"
            className="app-gear-btn classic-gear-btn"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            <GearIcon className="app-gear-icon classic-gear-icon" />
          </Button>
        </div>
      </header>

      <div className="rubric-home-scroll classic-rubric-scroll">
        <Button
          type="button"
          variant="unstyled"
          className="rubric-home-hero-card classic-hero-card"
          onClick={() => onOpenRubricWorkspace("input")}
        >
          <div className="rubric-home-hero-top classic-hero-card-top">
            <span className="rubric-home-wand-icon classic-wand-icon">
              <WandIcon className="classic-symbol-icon rubric-home-wand-svg classic-wand-svg" />
            </span>
          </div>
          <h2>AI 一键生成细则</h2>
          <div className="rubric-home-start-btn classic-start-btn">立即开始 →</div>
        </Button>

        <Card variant="unstyled" className="rubric-home-recent-panel classic-recent-panel">
          <div className="rubric-home-recent-header classic-recent-header">
            <span>已创建评分细则</span>
            <div className="classic-home-rubric-head-actions">
              <span className="rubric-home-action-count classic-action-count">{listCountLabel}</span>
              <button
                type="button"
                className="classic-home-rubric-refresh"
                onClick={() => {
                  void loadSummaries();
                }}
                disabled={loadingList}
              >
                {loadingList ? "加载中" : "刷新"}
              </button>
            </div>
          </div>

          {loadError ? <p className="classic-home-rubric-error">{loadError}</p> : null}

          {summaries.length === 0 ? (
            <div className="rubric-home-empty-card classic-empty-card">
              <strong>{loadingList ? "正在读取评分细则" : "暂无评分细则"}</strong>
              <p>{loadingList ? "请稍候..." : "先创建一个评分细则后，这里会自动显示列表。"}</p>
            </div>
          ) : (
            <div className="classic-home-rubric-list">
              {summaries.map((item) => (
                <button
                  key={item.questionId}
                  type="button"
                  className="classic-home-rubric-item"
                  onClick={() => onOpenRubricWorkspace("list")}
                >
                  <div>
                    <strong>{item.title || item.questionId}</strong>
                    <p>{formatSummarySubline(item)}</p>
                    <span>题号 {item.questionId} · 更新于 {formatDateLabel(item.updatedAt)}</span>
                  </div>
                  <em className={item.lifecycleStatus === "published" ? "is-published" : ""}>
                    {item.lifecycleStatus === "published" ? "已发布" : "草稿"}
                  </em>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};
