import { useEffect, useState } from "react";
import { ExamsPanel } from "./modules/exams/ExamsPanel";
import { GradingPanel } from "./modules/grading/GradingPanel";
import { HealthPanel } from "./modules/health/HealthPanel";
import { LicensePanel } from "./modules/license/LicensePanel";
import { RecordsPanel } from "./modules/records/RecordsPanel";
import { RubricPanel } from "./modules/rubric/RubricPanel";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

type ModuleView = "rubric" | "grading" | "records";

type ActiveTabContext = {
  tabId: number | null;
  url: string;
  title: string;
  supported: boolean;
};

type PageContextPayload = {
  sourceTabId?: number | null;
  reason?: string;
  href?: string;
  title?: string;
  platform?: string;
  timestamp?: string;
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

const ACTIVE_VIEW_STORAGE_KEY = "extension-app.legacy-heroui.active-view";

const getChromeRuntime = (): {
  sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
  onMessage?: {
    addListener: (listener: (message: unknown) => void) => void;
    removeListener: (listener: (message: unknown) => void) => void;
  };
} | null => {
  const runtime = (
    globalThis as typeof globalThis & {
      chrome?: {
        runtime?: {
          sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
          onMessage?: {
            addListener: (listener: (message: unknown) => void) => void;
            removeListener: (listener: (message: unknown) => void) => void;
          };
        };
      };
    }
  ).chrome?.runtime;

  return runtime ?? null;
};

const requestRuntimeData = <T,>(message: unknown): Promise<T | null> => {
  const runtime = getChromeRuntime();
  if (!runtime?.sendMessage) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    runtime.sendMessage?.(message, (response) => {
      const payload = response as { ok?: boolean; data?: T } | undefined;
      if (!payload?.ok) {
        resolve(null);
        return;
      }

      resolve(payload.data ?? null);
    });
  });
};

const getInitialView = (): ModuleView => {
  if (typeof window === "undefined") {
    return "rubric";
  }

  const savedView = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  if (savedView === "rubric" || savedView === "grading" || savedView === "records") {
    return savedView;
  }

  return "rubric";
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

  const [activeTabContext, setActiveTabContext] = useState<ActiveTabContext | null>(null);
  const [lastPageContext, setLastPageContext] = useState<PageContextPayload | null>(null);

  const [workspaceView, setWorkspaceView] = useState<ModuleView | null>(null);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const currentExamLabel = examName || examId || "未设置";
  const hasRubric = rubricText.trim().length > 0;
  const gradingStatus = hasRubric ? "可开始批改" : "缺少细则";
  const historyCount = latestGrading ? 1 : 0;

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    const runtime = getChromeRuntime();
    if (!runtime?.onMessage?.addListener) {
      return;
    }

    const handleMessage = (message: unknown): void => {
      const payload = message as
        | {
            type?: string;
            payload?: PageContextPayload;
          }
        | undefined;

      if (payload?.type === "PAGE_CONTEXT_BROADCAST" && payload.payload) {
        setLastPageContext(payload.payload);
      }
    };

    runtime.onMessage.addListener(handleMessage);

    return () => {
      runtime.onMessage?.removeListener(handleMessage);
    };
  }, []);

  useEffect(() => {
    void requestRuntimeData<ActiveTabContext>({ type: "GET_ACTIVE_TAB_CONTEXT" }).then((data) => {
      if (data) {
        setActiveTabContext(data);
      }
    });

    void requestRuntimeData<PageContextPayload>({ type: "GET_LAST_PAGE_CONTEXT" }).then((data) => {
      if (data) {
        setLastPageContext(data);
      }
    });
  }, []);

  return (
    <main className="legacy-app-shell">
      <header className="legacy-chrome-bar">
        <div className="legacy-chrome-title">
          <span className="legacy-chrome-app-dot" />
          AI 智能阅卷助手
        </div>
        <div className="legacy-chrome-actions">
          <button type="button" className="legacy-chrome-btn" aria-label="固定">
            ⌖
          </button>
          <button type="button" className="legacy-chrome-btn" aria-label="关闭">
            ×
          </button>
        </div>
      </header>

      <section className="legacy-body">
        {activeView === "rubric" ? (
          <>
            <header className="legacy-page-header">
              <div className="legacy-brand">
                <span className="legacy-brand-badge">AI</span>
                <span className="legacy-brand-title">智能阅卷</span>
              </div>
              <div className="legacy-header-right">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-settings-btn"
                  aria-label="设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <section className="legacy-content">
              <article className="legacy-hero-card">
                <div className="legacy-hero-top">
                  <div className="legacy-hero-icon">🪄</div>
                  <span className="legacy-hero-chip">AI 驱动</span>
                </div>
                <h2>智能创建细则</h2>
                <p>上传试题与答案，让 AI 自动分析并生成可编辑评分标准。</p>
                <button type="button" className="legacy-primary-action" onClick={() => setWorkspaceView("rubric")}>
                  立即开始
                </button>
              </article>

              <section className="legacy-grid-two">
                <article className="legacy-mini-card">
                  <div className="legacy-mini-icon legacy-mini-icon-blue">📄</div>
                  <h3>导入细则</h3>
                  <p>支持 JSON 文件继续编辑</p>
                </article>
                <article className="legacy-mini-card">
                  <div className="legacy-mini-icon legacy-mini-icon-purple">🧩</div>
                  <span className="legacy-mini-count">0</span>
                  <h3>模板库</h3>
                  <p>常用标准合集</p>
                </article>
              </section>

              <article className="legacy-recent-card">
                <header>
                  <span>最近细则</span>
                  <span className="legacy-mini-count">{hasRubric ? 1 : 0}</span>
                </header>
                <div className="legacy-empty-box">
                  <strong>{hasRubric ? "已有可用细则" : "暂无评分细则"}</strong>
                  <p>{hasRubric ? "可点击“立即开始”继续编辑" : "先创建或导入一个细则开始使用"}</p>
                </div>
              </article>
            </section>
          </>
        ) : null}

        {activeView === "grading" ? (
          <>
            <header className="legacy-page-header legacy-page-header-simple">
              <h1>AI 批改</h1>
              <div className="legacy-header-right">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-settings-btn"
                  aria-label="设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <section className="legacy-content">
              <article className="legacy-card">
                <header className="legacy-card-head">
                  <div>
                    <h2>GradingView</h2>
                    <p>默认主题批改工作台</p>
                  </div>
                  <span className="legacy-warn-chip">{gradingStatus}</span>
                </header>

                <div className="legacy-action-row">
                  <button type="button" className="legacy-btn-primary" onClick={() => setWorkspaceView("grading")}>
                    开始批改
                  </button>
                  <button type="button" className="legacy-btn-muted">
                    重新检测
                  </button>
                </div>

                <div className="legacy-info-grid">
                  <div className="legacy-info-box">
                    <span>当前题目标识</span>
                    <strong>{questionKey || "未设置"}</strong>
                  </div>
                  <div className="legacy-info-box">
                    <span>检测状态</span>
                    <strong>{activeTabContext?.supported ? "已检测到" : "未检测到"}</strong>
                  </div>
                </div>

                <div className="legacy-student-box">
                  <div>
                    <span>学生</span>
                    <strong>{latestGrading?.studentName || "未识别"}</strong>
                  </div>
                  <span className="legacy-mode-chip">辅助模式</span>
                </div>
              </article>

              <article className="legacy-warning-panel">
                <p>尚未配置评分细则，当前无法进行批改。</p>
                <button type="button" className="legacy-warning-btn" onClick={() => setWorkspaceView("rubric")}>
                  前往配置
                </button>
              </article>
            </section>
          </>
        ) : null}

        {activeView === "records" ? (
          <>
            <header className="legacy-page-header legacy-page-header-simple">
              <h1>批改历史</h1>
              <div className="legacy-header-right">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-settings-btn"
                  aria-label="设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <section className="legacy-content">
              <article className="legacy-card">
                <header className="legacy-card-head">
                  <div>
                    <h2>HistoryView</h2>
                    <p>历史记录检索与导出</p>
                  </div>
                  <span className="legacy-count-chip">{historyCount} 条</span>
                </header>

                <div className="legacy-search-box">搜索题号、题目标识或评语关键词</div>

                <div className="legacy-export-row">
                  <button type="button" className="legacy-btn-muted" onClick={() => setWorkspaceView("records")}>
                    导出 CSV
                  </button>
                  <button type="button" className="legacy-btn-muted" onClick={() => setWorkspaceView("records")}>
                    导出 JSON
                  </button>
                </div>

                <div className="legacy-table-head">
                  <span>时间</span>
                  <span>题目</span>
                  <span>得分</span>
                  <span>操作</span>
                </div>

                <div className="legacy-empty-history">暂无历史记录</div>
              </article>
            </section>
          </>
        ) : null}
      </section>

      <footer className="legacy-bottom-nav">
        <button
          type="button"
          className={`legacy-nav-btn ${activeView === "rubric" ? "legacy-nav-btn-active" : ""}`}
          onClick={() => setActiveView("rubric")}
        >
          <span>🧾</span>
          <span>评分细则</span>
        </button>
        <button
          type="button"
          className={`legacy-nav-btn ${activeView === "grading" ? "legacy-nav-btn-active" : ""}`}
          onClick={() => setActiveView("grading")}
        >
          <span>▦</span>
          <span>智能批改</span>
        </button>
        <button
          type="button"
          className={`legacy-nav-btn ${activeView === "records" ? "legacy-nav-btn-active" : ""}`}
          onClick={() => setActiveView("records")}
        >
          <span>↺</span>
          <span>阅卷记录</span>
        </button>
      </footer>

      {workspaceView ? (
        <div className="legacy-sheet-overlay">
          <section className="legacy-sheet">
            <header className="legacy-sheet-header">
              <strong>
                {workspaceView === "rubric"
                  ? "评分细则工作区"
                  : workspaceView === "grading"
                    ? "智能批改工作区"
                    : "记录工作区"}
              </strong>
              <button type="button" className="legacy-sheet-close" onClick={() => setWorkspaceView(null)}>
                关闭
              </button>
            </header>

            <div className="legacy-sheet-content">
              {workspaceView === "rubric" ? (
                <RubricPanel
                  questionKey={questionKey}
                  onQuestionKeyChange={setQuestionKey}
                  examId={examId}
                  onExamIdChange={setExamId}
                  rubricText={rubricText}
                  onRubricTextChange={setRubricText}
                />
              ) : null}

              {workspaceView === "grading" ? (
                <GradingPanel
                  questionKey={questionKey}
                  examId={examId}
                  examName={examName}
                  rubricText={rubricText}
                  onGradingCompleted={setLatestGrading}
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
        <div className="legacy-sheet-overlay">
          <section className="legacy-sheet">
            <header className="legacy-sheet-header">
              <strong>设置与基础环境</strong>
              <button type="button" className="legacy-sheet-close" onClick={() => setShowSettingsSheet(false)}>
                关闭
              </button>
            </header>

            <div className="legacy-sheet-content">
              <div className="module-grid">
                <HealthPanel />
                <LicensePanel />
                <SettingsPanel />
              </div>
              <ExamsPanel
                selectedExamId={examId}
                onSelectExamId={setExamId}
                onSelectedExamNameChange={setExamName}
              />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default App;
