import { useState } from "react";
import { ExamsPanel } from "./modules/exams/ExamsPanel";
import { GradingPanel } from "./modules/grading/GradingPanel";
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
  const [rubricText, setRubricText] = useState(DEFAULT_RUBRIC);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Extension App V2</h1>
        <p>阶段 B-1：延续原有 UI，先完成 Exams / Rubric / Grading / Records / License / Settings 接入 /api/v2/*</p>
      </header>

      <div className="module-grid">
        <LicensePanel />
        <SettingsPanel />
        <ExamsPanel selectedExamId={examId} onSelectExamId={setExamId} />
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
        <GradingPanel questionKey={questionKey} rubricText={rubricText} />
        <RecordsPanel questionKey={questionKey} />
      </div>
    </main>
  );
};

export default App;
