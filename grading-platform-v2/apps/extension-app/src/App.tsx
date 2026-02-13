import { useState } from "react";
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Extension App V2</h1>
        <p>阶段 B-1：延续原有 UI，完成 Health / Exams / Rubric / Grading / Records / License / Settings 接入</p>
      </header>

      <div className="module-grid">
        <HealthPanel />
        <LicensePanel />
        <SettingsPanel />
        <ExamsPanel
          selectedExamId={examId}
          onSelectExamId={setExamId}
          onSelectedExamNameChange={setExamName}
        />
      </div>

      <div className="module-stack">
        <RubricPanel
          questionKey={questionKey}
          onQuestionKeyChange={setQuestionKey}
          examId={examId}
          onExamIdChange={setExamId}
          rubricText={rubricText}
          onRubricTextChange={setRubricText}
        />
        <GradingPanel
          questionKey={questionKey}
          examId={examId}
          examName={examName}
          rubricText={rubricText}
          onGradingCompleted={setLatestGrading}
        />
        <RecordsPanel
          questionKey={questionKey}
          examId={examId}
          examName={examName}
          latestGrading={latestGrading}
        />
      </div>
    </main>
  );
};

export default App;
