import { AppTopHeader } from "../../app-shell/AppTopHeader";
import { Badge, Button, Card, StatusIndicator } from "@ai-grading/ui-kit";
import { GearIcon, UserIcon } from "../shared/icons";

type GradingHomeViewProps = {
  questionKey: string;
  hasRubric: boolean;
  gradingReadyLabel: string;
  studentName: string;
  detectedTab: boolean;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onOpenRubricWorkspace: () => void;
};

export const GradingHomeView = ({
  questionKey,
  hasRubric,
  gradingReadyLabel,
  studentName,
  detectedTab,
  onOpenSettings,
  onOpenWorkspace,
  onOpenRubricWorkspace
}: GradingHomeViewProps) => {
  return (
    <>
      <AppTopHeader
        title="AI 批改"
        onOpenSettings={onOpenSettings}
        gearIcon={<GearIcon className="classic-gear-icon" />}
      />

      <div className="classic-page-scroll">
        <Card variant="unstyled" className="classic-module-card">
          <header className="classic-module-header">
            <div>
              <h2>GradingView</h2>
              <p>默认主题批改工作台</p>
            </div>
            <Badge variant="warning" className="classic-warning-chip">
              {gradingReadyLabel}
            </Badge>
          </header>

          <div className="classic-dual-buttons">
            <Button type="button" variant="unstyled" className="classic-btn-primary" onClick={onOpenWorkspace}>
              开始批改
            </Button>
            <Button type="button" variant="unstyled" className="classic-btn-flat">
              重新检测
            </Button>
          </div>

          <div className="classic-status-grid">
            <div className="classic-status-item">
              <span>当前题目标识</span>
              <strong>{questionKey || "未设置"}</strong>
            </div>
            <StatusIndicator
              status={detectedTab ? "success" : "idle"}
              label={detectedTab ? "检测状态：已检测到" : "检测状态：未检测到"}
              className="classic-status-item classic-status-indicator"
            />
          </div>

          <div className="classic-student-row">
            <div>
              <span>学生</span>
              <strong>{studentName}</strong>
            </div>
            <div className="classic-student-right">
              <span className="classic-mode-chip">辅助模式</span>
              <UserIcon className="classic-symbol-icon classic-student-icon" />
            </div>
          </div>
        </Card>

        {!hasRubric ? (
          <Card variant="unstyled" className="classic-attention-card">
            <p>尚未配置评分细则，当前无法进行批改。</p>
            <Button type="button" variant="unstyled" onClick={onOpenRubricWorkspace}>
              前往配置
            </Button>
          </Card>
        ) : null}
      </div>
    </>
  );
};
