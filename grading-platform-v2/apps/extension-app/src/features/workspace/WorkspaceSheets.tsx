import { GradingPanel } from "../grading/GradingPanel";
import { RecordsPanel } from "../records/RecordsPanel";
import { RubricPanel } from "../rubric/RubricPanel";
import { SettingsSheetPanel } from "../settings/SettingsSheetPanel";
import type {
  LatestGrading,
  ModuleView,
  RubricEntryIntent
} from "../../store/useRootStore";
import { GearIcon } from "../shared/icons";

type WorkspaceSheetsProps = {
  workspaceView: ModuleView | null;
  showSettingsSheet: boolean;
  questionKey: string;
  examId: string;
  examName: string;
  rubricText: string;
  rubricEntryIntent: RubricEntryIntent;
  latestGrading: LatestGrading;
  onCloseWorkspace: () => void;
  onCloseSettings: () => void;
  onQuestionKeyChange: (value: string) => void;
  onExamIdChange: (value: string) => void;
  onRubricTextChange: (value: string) => void;
  onLatestGradingChange: (value: LatestGrading) => void;
  onOpenSettings: () => void;
};

export const WorkspaceSheets = ({
  workspaceView,
  showSettingsSheet,
  questionKey,
  examId,
  examName,
  rubricText,
  rubricEntryIntent,
  latestGrading,
  onCloseWorkspace,
  onCloseSettings,
  onQuestionKeyChange,
  onExamIdChange,
  onRubricTextChange,
  onLatestGradingChange,
  onOpenSettings
}: WorkspaceSheetsProps) => {
  return (
    <>
      {workspaceView ? (
        <div
          className={`classic-sheet-mask ${workspaceView === "rubric" ? "classic-sheet-mask-rubric" : ""}`}
          onClick={onCloseWorkspace}
        >
          <section
            className={`classic-sheet-panel ${workspaceView === "rubric" ? "classic-sheet-panel-rubric" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            {workspaceView !== "rubric" ? (
              <header className="classic-sheet-panel-header">
                <strong>
                  {workspaceView === "grading"
                    ? "智能批改工作区"
                    : "阅卷记录工作区"}
                </strong>
                <button type="button" className="classic-close-btn" onClick={onCloseWorkspace}>
                  关闭
                </button>
              </header>
            ) : null}

            <div className={`classic-sheet-panel-body ${workspaceView === "rubric" ? "classic-sheet-panel-body-rubric" : ""}`}>
              {workspaceView === "rubric" ? (
                <RubricPanel
                  questionKey={questionKey}
                  onQuestionKeyChange={onQuestionKeyChange}
                  examId={examId}
                  onExamIdChange={onExamIdChange}
                  rubricText={rubricText}
                  onRubricTextChange={onRubricTextChange}
                  entryIntent={rubricEntryIntent}
                  onOpenSettings={onOpenSettings}
                />
              ) : null}

              {workspaceView === "grading" ? (
                <GradingPanel
                  questionKey={questionKey}
                  examId={examId}
                  examName={examName}
                  rubricText={rubricText}
                  onGradingCompleted={onLatestGradingChange}
                />
              ) : null}

              {workspaceView === "records" ? (
                <RecordsPanel
                  questionKey={questionKey}
                  examId={examId}
                  examName={examName}
                  latestGrading={latestGrading}
                />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {showSettingsSheet ? (
        <div
          className="classic-sheet-mask classic-sheet-mask-settings"
          onClick={onCloseSettings}
        >
          <section
            className="classic-sheet-panel classic-sheet-panel-settings"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="classic-sheet-panel-header classic-sheet-panel-header-settings">
              <strong>系统设置</strong>
              <div className="classic-header-actions">
                <span className="classic-trial-chip">试用版</span>
                <button
                  type="button"
                  className="classic-gear-btn"
                  aria-label="关闭设置"
                  onClick={onCloseSettings}
                >
                  <GearIcon className="classic-gear-icon" />
                </button>
              </div>
            </header>

            <div className="classic-sheet-panel-body classic-sheet-panel-body-settings">
              <SettingsSheetPanel />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};
