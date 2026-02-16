import type { RubricEntryIntent } from "../../store/useRootStore";
import { Badge, Button, Card } from "@ai-grading/ui-kit";
import { FileIcon, GearIcon, PuzzleIcon, WandIcon } from "../shared/icons";

type HomeRubricPreview = {
  title: string;
  questionId: string;
  pointCount: number;
  totalScore: number;
};

type RubricHomeViewProps = {
  questionKey: string;
  rubricText: string;
  hasRubric: boolean;
  rubricCountLabel: string;
  onOpenSettings: () => void;
  onOpenRubricWorkspace: (intent: RubricEntryIntent) => void;
  onOpenGeneratedResult: () => void;
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

const toPositiveNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildHomeRubricPreview = (rubricText: string, fallbackQuestionKey: string): HomeRubricPreview | null => {
  const trimmed = rubricText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const root = toRecord(parsed);
    if (!root) {
      return null;
    }

    const metadata = toRecord(root.metadata) ?? {};
    const content = toRecord(root.content) ?? {};
    const points = [
      ...toRecordList(root.answerPoints),
      ...toRecordList(content.points),
      ...toRecordList(content.steps)
    ];
    const pointScore = points.reduce((sum, point) => sum + toPositiveNumber(point.score), 0);
    const totalScore = toPositiveNumber(root.totalScore)
      || toPositiveNumber(content.totalScore)
      || toPositiveNumber(metadata.totalScore)
      || pointScore;

    return {
      title: firstText(metadata.title) || "已生成评分细则",
      questionId: firstText(metadata.questionId, root.questionId, root.questionKey) || fallbackQuestionKey || "未命名题号",
      pointCount: points.length,
      totalScore
    };
  } catch {
    return {
      title: "已生成评分细则",
      questionId: fallbackQuestionKey || "未命名题号",
      pointCount: 0,
      totalScore: 0
    };
  }
};

export const RubricHomeView = ({
  questionKey,
  rubricText,
  hasRubric,
  rubricCountLabel,
  onOpenSettings,
  onOpenRubricWorkspace,
  onOpenGeneratedResult
}: RubricHomeViewProps) => {
  const latestPreview = buildHomeRubricPreview(rubricText, questionKey);

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
            <span className="rubric-home-ai-chip classic-ai-chip">AI 驱动</span>
          </div>
          <h2>智能创建细则</h2>
          <p>上传试题与答案，让 AI 自动分析并生成可编辑评分标准。</p>
          <div className="rubric-home-start-btn classic-start-btn">立即开始</div>
        </Button>

        <div className="rubric-home-action-grid classic-action-grid">
          <Button
            type="button"
            variant="unstyled"
            className="rubric-home-action-card classic-action-card"
            onClick={() => onOpenRubricWorkspace("import")}
          >
            <span className="rubric-home-action-icon rubric-home-action-icon-cyan classic-action-icon classic-action-icon-cyan">
              <FileIcon className="classic-symbol-icon rubric-home-action-svg classic-action-svg" />
            </span>
            <strong>导入细则</strong>
            <span>支持 JSON 文件继续编辑</span>
          </Button>

          <Button
            type="button"
            variant="unstyled"
            className="rubric-home-action-card classic-action-card"
            onClick={() => onOpenRubricWorkspace("list")}
          >
            <span className="rubric-home-action-icon rubric-home-action-icon-purple classic-action-icon classic-action-icon-purple">
              <PuzzleIcon className="classic-symbol-icon rubric-home-action-svg classic-action-svg" />
            </span>
            <span className="rubric-home-action-count classic-action-count">{rubricCountLabel}</span>
            <strong>模板库</strong>
            <span>常用标准合集</span>
          </Button>
        </div>

        <Card variant="unstyled" className="rubric-home-recent-panel classic-recent-panel">
          <div className="classic-recent-header classic-home-generated-header">
            <span>已生成结果</span>
            <button
              type="button"
              className="classic-home-generated-link"
              onClick={onOpenGeneratedResult}
              disabled={!hasRubric}
            >
              查看预览
            </button>
          </div>
          {hasRubric && latestPreview ? (
            <div className="classic-home-generated-card">
              <strong>{latestPreview.title}</strong>
              <p>
                题号 {latestPreview.questionId} · 得分点 {latestPreview.pointCount} 条 · 总分 {latestPreview.totalScore}
              </p>
            </div>
          ) : (
            <div className="classic-empty-card">
              <strong>暂无生成结果</strong>
              <p>进入新建页生成后，可在这里快速回看预览。</p>
            </div>
          )}
        </Card>

        <Card variant="unstyled" className="rubric-home-recent-panel classic-recent-panel">
          <div className="rubric-home-recent-header classic-recent-header">
            <span>最近细则</span>
            <span className="rubric-home-action-count classic-action-count">{rubricCountLabel}</span>
          </div>
          <div className="rubric-home-empty-card classic-empty-card">
            <strong>{hasRubric ? "已有评分细则" : "暂无评分细则"}</strong>
            <p>{hasRubric ? `当前题目标识：${questionKey}` : "先创建或导入一个细则开始使用"}</p>
          </div>
        </Card>
      </div>
    </>
  );
};
