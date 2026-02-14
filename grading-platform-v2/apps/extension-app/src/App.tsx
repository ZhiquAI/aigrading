import { useEffect, useMemo, useState } from "react";
import { ExamsPanel } from "./modules/exams/ExamsPanel";
import { GradingPanel } from "./modules/grading/GradingPanel";
import { HealthPanel } from "./modules/health/HealthPanel";
import { LicensePanel } from "./modules/license/LicensePanel";
import { RecordsPanel } from "./modules/records/RecordsPanel";
import { RubricPanel } from "./modules/rubric/RubricPanel";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

type ModuleView = "health" | "exams" | "rubric" | "grading" | "records";

type WorkflowStep = {
  id: string;
  label: string;
  done: boolean;
  targetView: ModuleView;
};

const DEFAULT_RUBRIC = JSON.stringify(
  {
    version: "2.0",
    scoringStrategy: "all",
    answerPoints: [
      {
        id: "p1",
        content: "史实准确，关键事件表述完整",
        keywords: ["史实", "事件", "时间线"],
        score: 5
      },
      {
        id: "p2",
        content: "论证逻辑清晰，有因果分析",
        keywords: ["原因", "影响", "逻辑"],
        score: 5
      }
    ],
    gradingNotes: "按命中要点给分，可结合表达质量酌情浮动。",
    metadata: {
      questionId: "Q1",
      title: "默认示例 Rubric"
    }
  },
  null,
  2
);

const ACTIVE_VIEW_STORAGE_KEY = "extension-app.active-view";

const getInitialView = (): ModuleView => {
  if (typeof window === "undefined") {
    return "health";
  }

  const savedView = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  if (
    savedView === "health" ||
    savedView === "exams" ||
    savedView === "rubric" ||
    savedView === "grading" ||
    savedView === "records"
  ) {
    return savedView;
  }

  return "health";
};

const App = () => {
  const [questionKey, setQuestionKey] = useState("Q1");
  const [examId, setExamId] = useState("");
  const [examName, setExamName] = useState("");
  const [rubricText, setRubricText] = useState(DEFAULT_RUBRIC);
  const [activeView, setActiveView] = useState<ModuleView>(() => getInitialView());
  const [latestGrading, setLatestGrading] = useState<{
    score: number;
    maxScore: number;
    comment: string;
    breakdown: unknown;
    studentName: string;
    questionNo: string;
    questionKey: string;
    examNo: string;
  } | null>(null);

  const currentExamLabel = useMemo(() => {
    return examName || examId || "未选择";
  }, [examId, examName]);

  const lastScoreLabel = useMemo(() => {
    return latestGrading ? `${latestGrading.score}/${latestGrading.maxScore}` : "暂无";
  }, [latestGrading]);

  const hasExamSelection = useMemo(() => examId.trim().length > 0, [examId]);
  const hasRubricDraft = useMemo(() => rubricText.trim().length > 0, [rubricText]);
  const hasGradingResult = useMemo(() => latestGrading !== null, [latestGrading]);

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    return [
      { id: "step-1", label: "基础校验", done: true, targetView: "health" },
      { id: "step-2", label: "选择考试", done: hasExamSelection, targetView: "exams" },
      { id: "step-3", label: "准备 Rubric", done: hasRubricDraft, targetView: "rubric" },
      { id: "step-4", label: "AI 批改", done: hasGradingResult, targetView: "grading" },
      { id: "step-5", label: "记录归档", done: hasGradingResult, targetView: "records" }
    ];
  }, [hasExamSelection, hasRubricDraft, hasGradingResult]);

  const completedSteps = useMemo(() => {
    return workflowSteps.filter((item) => item.done).length;
  }, [workflowSteps]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  const moduleStatusMap = useMemo(() => {
    return {
      health: { label: "基础配置", done: true },
      exams: { label: hasExamSelection ? "已选考试" : "待选择", done: hasExamSelection },
      rubric: { label: hasRubricDraft ? "已准备" : "待准备", done: hasRubricDraft },
      grading: { label: hasGradingResult ? "已批改" : "待批改", done: hasGradingResult },
      records: { label: hasGradingResult ? "可归档" : "等待结果", done: hasGradingResult }
    };
  }, [hasExamSelection, hasRubricDraft, hasGradingResult]);

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <h1>Extension App V2 Workbench</h1>
        <p>阶段 B-2（可控重设计）：保留 v2 业务契约，升级交互与可维护性。</p>
      </header>

      <section className="context-strip context-strip-rich context-strip-split">
        <div className="context-metrics">
          <span>
            <strong>流程进度:</strong> {completedSteps}/{workflowSteps.length}
          </span>
          <span>
            <strong>当前题目:</strong> {questionKey || "-"}
          </span>
          <span>
            <strong>当前考试:</strong> {currentExamLabel}
          </span>
          <span>
            <strong>最近得分:</strong> {lastScoreLabel}
          </span>
        </div>
        <div className="quick-actions">
          <button type="button" className="secondary-btn quick-action-btn" onClick={() => setActiveView("exams")}>
            去考试
          </button>
          <button type="button" className="secondary-btn quick-action-btn" onClick={() => setActiveView("rubric")}>
            去 Rubric
          </button>
          <button type="button" className="secondary-btn quick-action-btn" onClick={() => setActiveView("grading")}>
            去批改
          </button>
          <button type="button" className="secondary-btn quick-action-btn" onClick={() => setActiveView("records")}>
            去记录
          </button>
        </div>
      </section>

      <section className="workflow-progress">
        {workflowSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`progress-step ${step.done ? "progress-step-done" : ""}`}
            onClick={() => setActiveView(step.targetView)}
          >
            <span className="progress-dot" />
            <span>{step.label}</span>
          </button>
        ))}
      </section>

      <div className="workspace-main">
        <aside className="workspace-nav">
          <button
            type="button"
            className={`nav-btn ${activeView === "health" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("health")}
          >
            健康 / 授权 / 设置
            <span className={`status-chip ${moduleStatusMap.health.done ? "status-chip-done" : ""}`}>
              {moduleStatusMap.health.label}
            </span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "exams" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("exams")}
          >
            考试会话
            <span className={`status-chip ${moduleStatusMap.exams.done ? "status-chip-done" : ""}`}>
              {moduleStatusMap.exams.label}
            </span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "rubric" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("rubric")}
          >
            评分细则
            <span className={`status-chip ${moduleStatusMap.rubric.done ? "status-chip-done" : ""}`}>
              {moduleStatusMap.rubric.label}
            </span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "grading" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("grading")}
          >
            AI 批改
            <span className={`status-chip ${moduleStatusMap.grading.done ? "status-chip-done" : ""}`}>
              {moduleStatusMap.grading.label}
            </span>
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "records" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("records")}
          >
            批改记录
            <span className={`status-chip ${moduleStatusMap.records.done ? "status-chip-done" : ""}`}>
              {moduleStatusMap.records.label}
            </span>
          </button>

          <div className="workspace-tip">
            <h3>工作流建议</h3>
            <p>先建立考试，再创建 rubric，接着批改并写入记录。</p>
          </div>
        </aside>

        <section className="workspace-content">
          <section className={`panel-stage ${activeView === "health" ? "panel-stage-active" : ""}`}>
            <div className="module-grid">
              <HealthPanel />
              <LicensePanel />
              <SettingsPanel />
            </div>
          </section>

          <section className={`panel-stage ${activeView === "exams" ? "panel-stage-active" : ""}`}>
            <ExamsPanel
              selectedExamId={examId}
              onSelectExamId={setExamId}
              onSelectedExamNameChange={setExamName}
            />
          </section>

          <section className={`panel-stage ${activeView === "rubric" ? "panel-stage-active" : ""}`}>
            <RubricPanel
              questionKey={questionKey}
              onQuestionKeyChange={setQuestionKey}
              examId={examId}
              onExamIdChange={setExamId}
              rubricText={rubricText}
              onRubricTextChange={setRubricText}
            />
          </section>

          <section className={`panel-stage ${activeView === "grading" ? "panel-stage-active" : ""}`}>
            <GradingPanel
              questionKey={questionKey}
              examId={examId}
              examName={examName}
              rubricText={rubricText}
              onGradingCompleted={setLatestGrading}
            />
          </section>

          <section className={`panel-stage ${activeView === "records" ? "panel-stage-active" : ""}`}>
            <RecordsPanel
              questionKey={questionKey}
              examId={examId}
              examName={examName}
              latestGrading={latestGrading}
            />
          </section>
        </section>
      </div>
    </main>
  );
};

export default App;
