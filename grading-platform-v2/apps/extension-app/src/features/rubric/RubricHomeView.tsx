import type { RubricEntryIntent } from "../../store/useRootStore";
import { Badge, Button, Card } from "@ai-grading/ui-kit";
import { FileIcon, GearIcon, PuzzleIcon, WandIcon } from "../shared/icons";

type RubricHomeViewProps = {
  questionKey: string;
  hasRubric: boolean;
  rubricCountLabel: string;
  onOpenSettings: () => void;
  onOpenRubricWorkspace: (intent: RubricEntryIntent) => void;
};

export const RubricHomeView = ({
  questionKey,
  hasRubric,
  rubricCountLabel,
  onOpenSettings,
  onOpenRubricWorkspace
}: RubricHomeViewProps) => {
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
