import { useEffect, useMemo } from "react";
import { AppBottomNav } from "./app-shell/AppBottomNav";
import { GradingHomeView } from "./features/grading/GradingHomeView";
import { RecordsHomeView } from "./features/records/RecordsHomeView";
import { RubricHomeView } from "./features/rubric/RubricHomeView";
import {
  ClipboardIcon,
  GridIcon,
  HistoryIcon
} from "./features/shared/icons";
import { WorkspaceSheets } from "./features/workspace/WorkspaceSheets";
import {
  rootStoreActions,
  useRootStore,
  type ActiveTabContext,
  type ModuleView,
  type PageContextPayload,
  type RubricEntryIntent
} from "./store/useRootStore";

const ACTIVE_VIEW_STORAGE_KEY = "extension-app.heroui.active-view";
const CLASSIC_ACTIVE_VIEW_STORAGE_KEY = "extension-app.classic-heroui.active-view";
const PREVIOUS_ACTIVE_VIEW_STORAGE_KEY = `extension-app.${"legacy"}-heroui.active-view`;

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

  const savedView =
    window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) ??
    window.localStorage.getItem(CLASSIC_ACTIVE_VIEW_STORAGE_KEY) ??
    window.localStorage.getItem(PREVIOUS_ACTIVE_VIEW_STORAGE_KEY);
  if (savedView === "rubric" || savedView === "grading" || savedView === "records") {
    return savedView;
  }

  return "rubric";
};

const App = () => {
  const questionKey = useRootStore((store) => store.rubricSlice.questionKey);
  const examId = useRootStore((store) => store.rubricSlice.examId);
  const examName = useRootStore((store) => store.rubricSlice.examName);
  const rubricText = useRootStore((store) => store.rubricSlice.rubricText);
  const rubricEntryIntent = useRootStore((store) => store.rubricSlice.rubricEntryIntent);

  const latestGrading = useRootStore((store) => store.gradingSlice.latestGrading);
  const gradingMode = useRootStore((store) => store.settingsSlice.gradingMode);
  const activeTabContext = useRootStore((store) => store.sessionSlice.activeTabContext);
  const recordTotalCount = useRootStore((store) => store.recordSlice.totalCount);

  const activeView = useRootStore((store) => store.uiSlice.activeView);
  const workspaceView = useRootStore((store) => store.uiSlice.workspaceView);
  const showSettingsSheet = useRootStore((store) => store.uiSlice.showSettingsSheet);

  const setQuestionKey = rootStoreActions.setQuestionKey;
  const setExamId = rootStoreActions.setExamId;
  const setRubricText = rootStoreActions.setRubricText;
  const setLatestGrading = rootStoreActions.setLatestGrading;
  const setActiveTabContext = rootStoreActions.setActiveTabContext;
  const setLastPageContext = rootStoreActions.setLastPageContext;
  const setActiveView = rootStoreActions.setActiveView;
  const setWorkspaceView = rootStoreActions.setWorkspaceView;
  const setRubricEntryIntent = rootStoreActions.setRubricEntryIntent;
  const setShowSettingsSheet = rootStoreActions.setShowSettingsSheet;

  const hasRubric = useMemo(() => rubricText.trim().length > 0, [rubricText]);
  const gradingReadyLabel = hasRubric ? "细则已就绪" : "缺少细则";

  const openRubricWorkspace = (intent: RubricEntryIntent): void => {
    setRubricEntryIntent(intent);
    setWorkspaceView("rubric");
  };

  useEffect(() => {
    rootStoreActions.setActiveView(getInitialView());
  }, []);

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
  }, [setLastPageContext]);

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
  }, [setActiveTabContext, setLastPageContext]);

  return (
    <main className="classic-shell">
      <section
        className={`classic-page-area ${
          activeView === "rubric" ? "classic-page-area-rubric" : "classic-page-area-plain"
        } classic-page-area-${activeView}`}
      >
        {activeView === "rubric" ? (
          <RubricHomeView
            onOpenSettings={() => setShowSettingsSheet(true)}
            onOpenRubricWorkspace={openRubricWorkspace}
          />
        ) : null}

        {activeView === "grading" ? (
          <GradingHomeView
            questionKey={questionKey}
            hasRubric={hasRubric}
            gradingReadyLabel={gradingReadyLabel}
            gradingMode={gradingMode}
            studentName={latestGrading?.studentName || "未识别"}
            detectedTab={activeTabContext?.supported ?? false}
            onOpenSettings={() => setShowSettingsSheet(true)}
            onOpenWorkspace={() => setWorkspaceView("grading")}
            onOpenRubricWorkspace={() => openRubricWorkspace("input")}
          />
        ) : null}

        {activeView === "records" ? (
          <RecordsHomeView
            recordCount={recordTotalCount}
            onOpenSettings={() => setShowSettingsSheet(true)}
            onOpenWorkspace={() => setWorkspaceView("records")}
          />
        ) : null}
      </section>

      <AppBottomNav
        activeView={activeView}
        items={[
          {
            key: "rubric",
            label: "评分细则",
            icon: <ClipboardIcon className="classic-symbol-icon classic-nav-icon" />,
            className: "classic-nav-item-rubric",
            active: activeView === "rubric",
            onClick: () => setActiveView("rubric")
          },
          {
            key: "grading",
            label: "智能批改",
            icon: <GridIcon className="classic-symbol-icon classic-nav-icon" />,
            className: "classic-nav-item-grading",
            active: activeView === "grading",
            onClick: () => setActiveView("grading")
          },
          {
            key: "records",
            label: "阅卷记录",
            icon: <HistoryIcon className="classic-symbol-icon classic-nav-icon" />,
            className: "classic-nav-item-records",
            active: activeView === "records",
            onClick: () => setActiveView("records")
          }
        ]}
      />

      <WorkspaceSheets
        workspaceView={workspaceView}
        showSettingsSheet={showSettingsSheet}
        questionKey={questionKey}
        examId={examId}
        examName={examName}
        rubricText={rubricText}
        rubricEntryIntent={rubricEntryIntent}
        latestGrading={latestGrading}
        onCloseWorkspace={() => setWorkspaceView(null)}
        onCloseSettings={() => setShowSettingsSheet(false)}
        onQuestionKeyChange={setQuestionKey}
        onExamIdChange={setExamId}
        onRubricTextChange={setRubricText}
        onLatestGradingChange={setLatestGrading}
        onOpenSettings={() => setShowSettingsSheet(true)}
      />
    </main>
  );
};

export default App;
