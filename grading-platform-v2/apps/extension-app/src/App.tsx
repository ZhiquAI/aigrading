import { useEffect, useMemo, useState } from "react";
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
  const [questionKey, setQuestionKey] = useState("");
  const [examId, setExamId] = useState("");
  const [examName, setExamName] = useState("");
  const [rubricText, setRubricText] = useState("");
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

  const hasRubric = useMemo(() => rubricText.trim().length > 0, [rubricText]);
  const rubricCountLabel = hasRubric ? "1" : "0";
  const gradingReadyLabel = hasRubric ? "细则已就绪" : "缺少细则";

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
    <main className="legacy-shell">
      <section
        className={`legacy-page-area ${activeView === "rubric" ? "legacy-page-area-rubric" : "legacy-page-area-plain"}`}
      >
        {activeView === "rubric" ? (
          <>
            <header className="legacy-rubric-header">
              <div className="legacy-rubric-title-wrap">
                <span className="legacy-rubric-ai-pill">AI</span>
                <h1>智能阅卷</h1>
              </div>

              <div className="legacy-header-actions">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-gear-btn"
                  aria-label="打开设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <div className="legacy-rubric-scroll">
              <button type="button" className="legacy-hero-card" onClick={() => setWorkspaceView("rubric")}>
                <div className="legacy-hero-card-top">
                  <span className="legacy-wand-icon">🪄</span>
                  <span className="legacy-ai-chip">AI 驱动</span>
                </div>
                <h2>智能创建细则</h2>
                <p>上传试题与答案，让 AI 自动分析并生成可编辑评分标准。</p>
                <div className="legacy-start-btn">立即开始</div>
              </button>

              <div className="legacy-action-grid">
                <button type="button" className="legacy-action-card" onClick={() => setWorkspaceView("rubric")}>
                  <span className="legacy-action-icon legacy-action-icon-cyan">📄</span>
                  <strong>导入细则</strong>
                  <span>支持 JSON 文件继续编辑</span>
                </button>

                <button type="button" className="legacy-action-card" onClick={() => setWorkspaceView("rubric")}>
                  <span className="legacy-action-icon legacy-action-icon-purple">🧩</span>
                  <span className="legacy-action-count">{rubricCountLabel}</span>
                  <strong>模板库</strong>
                  <span>常用标准合集</span>
                </button>
              </div>

              <article className="legacy-recent-panel">
                <div className="legacy-recent-header">
                  <span>最近细则</span>
                  <span className="legacy-action-count">{rubricCountLabel}</span>
                </div>
                <div className="legacy-empty-card">
                  <strong>{hasRubric ? "已有评分细则" : "暂无评分细则"}</strong>
                  <p>{hasRubric ? `当前题目标识：${questionKey}` : "先创建或导入一个细则开始使用"}</p>
                </div>
              </article>
            </div>
          </>
        ) : null}

        {activeView === "grading" ? (
          <>
            <header className="legacy-simple-header">
              <h1>AI 批改</h1>
              <div className="legacy-header-actions">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-gear-btn"
                  aria-label="打开设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <div className="legacy-page-scroll">
              <article className="legacy-module-card">
                <header className="legacy-module-header">
                  <div>
                    <h2>GradingView</h2>
                    <p>默认主题批改工作台</p>
                  </div>
                  <span className="legacy-warning-chip">{gradingReadyLabel}</span>
                </header>

                <div className="legacy-dual-buttons">
                  <button type="button" className="legacy-btn-primary" onClick={() => setWorkspaceView("grading")}>
                    开始批改
                  </button>
                  <button type="button" className="legacy-btn-flat">
                    重新检测
                  </button>
                </div>

                <div className="legacy-status-grid">
                  <div className="legacy-status-item">
                    <span>当前题目标识</span>
                    <strong>{questionKey || "未设置"}</strong>
                  </div>
                  <div className="legacy-status-item">
                    <span>检测状态</span>
                    <strong>{activeTabContext?.supported ? "已检测到" : "未检测到"}</strong>
                  </div>
                </div>

                <div className="legacy-student-row">
                  <div>
                    <span>学生</span>
                    <strong>{latestGrading?.studentName || "未识别"}</strong>
                  </div>
                  <div className="legacy-student-right">
                    <span className="legacy-mode-chip">辅助模式</span>
                    <span className="legacy-student-icon">◌</span>
                  </div>
                </div>
              </article>

              {!hasRubric ? (
                <article className="legacy-attention-card">
                  <p>尚未配置评分细则，当前无法进行批改。</p>
                  <button type="button" onClick={() => setWorkspaceView("rubric")}>前往配置</button>
                </article>
              ) : null}
            </div>
          </>
        ) : null}

        {activeView === "records" ? (
          <>
            <header className="legacy-simple-header">
              <h1>批改历史</h1>
              <div className="legacy-header-actions">
                <span className="legacy-trial-chip">试用版</span>
                <button
                  type="button"
                  className="legacy-gear-btn"
                  aria-label="打开设置"
                  onClick={() => setShowSettingsSheet(true)}
                >
                  ⚙
                </button>
              </div>
            </header>

            <div className="legacy-page-scroll">
              <article className="legacy-module-card">
                <header className="legacy-module-header">
                  <div>
                    <h2>HistoryView</h2>
                    <p>历史记录检索与导出</p>
                  </div>
                  <span className="legacy-count-chip">{latestGrading ? 1 : 0} 条</span>
                </header>

                <div className="legacy-search-input">搜索题号、题目标识或评语关键词</div>

                <div className="legacy-export-buttons">
                  <button type="button" className="legacy-btn-flat" onClick={() => setWorkspaceView("records")}>
                    导出 CSV
                  </button>
                  <button type="button" className="legacy-btn-flat" onClick={() => setWorkspaceView("records")}>
                    导出 JSON
                  </button>
                </div>

                <div className="legacy-table-head-row">
                  <span>时间</span>
                  <span>题目</span>
                  <span>得分</span>
                  <span>操作</span>
                </div>

                <div className="legacy-history-empty">暂无历史记录</div>
              </article>
            </div>
          </>
        ) : null}
      </section>

      <footer className="legacy-nav">
        <button
          type="button"
          className={`legacy-nav-item ${activeView === "rubric" ? "legacy-nav-item-active" : ""}`}
          onClick={() => setActiveView("rubric")}
        >
          <span className="legacy-nav-icon">🧾</span>
          <span>评分细则</span>
        </button>

        <button
          type="button"
          className={`legacy-nav-item ${activeView === "grading" ? "legacy-nav-item-active" : ""}`}
          onClick={() => setActiveView("grading")}
        >
          <span className="legacy-nav-icon">▦</span>
          <span>智能批改</span>
        </button>

        <button
          type="button"
          className={`legacy-nav-item ${activeView === "records" ? "legacy-nav-item-active" : ""}`}
          onClick={() => setActiveView("records")}
        >
          <span className="legacy-nav-icon">↻</span>
          <span>阅卷记录</span>
        </button>
      </footer>

      {workspaceView ? (
        <div className="legacy-sheet-mask">
          <section className="legacy-sheet-panel">
            <header className="legacy-sheet-panel-header">
              <strong>
                {workspaceView === "rubric"
                  ? "评分细则工作区"
                  : workspaceView === "grading"
                    ? "智能批改工作区"
                    : "阅卷记录工作区"}
              </strong>
              <button type="button" className="legacy-close-btn" onClick={() => setWorkspaceView(null)}>
                关闭
              </button>
            </header>

            <div className="legacy-sheet-panel-body">
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
        <div className="legacy-sheet-mask">
          <section className="legacy-sheet-panel">
            <header className="legacy-sheet-panel-header">
              <strong>设置与基础环境</strong>
              <button type="button" className="legacy-close-btn" onClick={() => setShowSettingsSheet(false)}>
                关闭
              </button>
            </header>

            <div className="legacy-sheet-panel-body">
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

              {lastPageContext ? (
                <p className="hint">页面平台：{lastPageContext.platform || "-"}</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default App;
