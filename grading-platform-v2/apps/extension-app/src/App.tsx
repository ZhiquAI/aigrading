import { useMemo, useState } from "react";
import { ExamsPanel } from "./modules/exams/ExamsPanel";
import { GradingPanel } from "./modules/grading/GradingPanel";
import { HealthPanel } from "./modules/health/HealthPanel";
import { LicensePanel } from "./modules/license/LicensePanel";
import { RecordsPanel } from "./modules/records/RecordsPanel";
import { RubricPanel } from "./modules/rubric/RubricPanel";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

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

const App = () => {
  const [questionKey, setQuestionKey] = useState("Q1");
  const [examId, setExamId] = useState("");
  const [examName, setExamName] = useState("");
  const [rubricText, setRubricText] = useState(DEFAULT_RUBRIC);
  const [activeView, setActiveView] = useState<
    "health" | "exams" | "rubric" | "grading" | "records"
  >("health");
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

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <h1>Extension App V2 Workbench</h1>
        <p>阶段 B-2（可控重设计）：保留 v2 业务契约，升级交互与可维护性。</p>
      </header>

      <section className="context-strip context-strip-rich">
        <span>
          <strong>当前题目:</strong> {questionKey || "-"}
        </span>
        <span>
          <strong>当前考试:</strong> {currentExamLabel}
        </span>
        <span>
          <strong>最近得分:</strong> {lastScoreLabel}
        </span>
      </section>

      <div className="workspace-main">
        <aside className="workspace-nav">
          <button
            type="button"
            className={`nav-btn ${activeView === "health" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("health")}
          >
            健康 / 授权 / 设置
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "exams" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("exams")}
          >
            考试会话
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "rubric" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("rubric")}
          >
            评分细则
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "grading" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("grading")}
          >
            AI 批改
          </button>
          <button
            type="button"
            className={`nav-btn ${activeView === "records" ? "nav-btn-active" : ""}`}
            onClick={() => setActiveView("records")}
          >
            批改记录
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
