import { useSyncExternalStore } from "react";
import type { GradingResult } from "@ai-grading/domain-core";

export type ModuleView = "rubric" | "grading" | "records";
export type RubricEntryIntent = "input" | "list" | "import";

export type ActiveTabContext = {
  tabId: number | null;
  url: string;
  title: string;
  supported: boolean;
};

export type PageContextPayload = {
  sourceTabId?: number | null;
  reason?: string;
  href?: string;
  title?: string;
  platform?: string;
  timestamp?: string;
};

export type LatestGrading = {
  score: number;
  maxScore: number;
  comment: string;
  breakdown: GradingResult | Array<Record<string, unknown>> | Record<string, unknown> | string | null;
  studentName: string;
  questionNo: string;
  questionKey: string;
  examNo: string;
} | null;

export type RootState = {
  sessionSlice: {
    activeTabContext: ActiveTabContext | null;
    lastPageContext: PageContextPayload | null;
  };
  licenseSlice: {
    activationCode: string;
    status: "unknown" | "active" | "inactive" | "expired";
    remainingQuota: number | null;
  };
  rubricSlice: {
    questionKey: string;
    examId: string;
    examName: string;
    rubricText: string;
    rubricEntryIntent: RubricEntryIntent;
  };
  gradingSlice: {
    latestGrading: LatestGrading;
  };
  recordSlice: {
    totalCount: number;
    lastSyncAt: string | null;
  };
  settingsSlice: {
    provider: string;
    modelName: string;
    gradingMode: "assist" | "auto";
  };
  uiSlice: {
    activeView: ModuleView;
    workspaceView: ModuleView | null;
    showSettingsSheet: boolean;
  };
};

const createInitialState = (): RootState => ({
  sessionSlice: {
    activeTabContext: null,
    lastPageContext: null
  },
  licenseSlice: {
    activationCode: "",
    status: "unknown",
    remainingQuota: null
  },
  rubricSlice: {
    questionKey: "",
    examId: "",
    examName: "",
    rubricText: "",
    rubricEntryIntent: "input"
  },
  gradingSlice: {
    latestGrading: null
  },
  recordSlice: {
    totalCount: 0,
    lastSyncAt: null
  },
  settingsSlice: {
    provider: "openai",
    modelName: "",
    gradingMode: "assist"
  },
  uiSlice: {
    activeView: "rubric",
    workspaceView: null,
    showSettingsSheet: false
  }
});

let state: RootState = createInitialState();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): RootState => state;

const updateState = (updater: (current: RootState) => RootState): void => {
  state = updater(state);
  listeners.forEach((listener) => listener());
};

export const useRootStore = <T>(selector: (store: RootState) => T): T => {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot())
  );
};

export const rootStoreActions = {
  setActiveView(view: ModuleView): void {
    updateState((current) => ({
      ...current,
      uiSlice: {
        ...current.uiSlice,
        activeView: view
      }
    }));
  },
  setWorkspaceView(view: ModuleView | null): void {
    updateState((current) => ({
      ...current,
      uiSlice: {
        ...current.uiSlice,
        workspaceView: view
      }
    }));
  },
  setShowSettingsSheet(value: boolean): void {
    updateState((current) => ({
      ...current,
      uiSlice: {
        ...current.uiSlice,
        showSettingsSheet: value
      }
    }));
  },
  setRubricEntryIntent(value: RubricEntryIntent): void {
    updateState((current) => ({
      ...current,
      rubricSlice: {
        ...current.rubricSlice,
        rubricEntryIntent: value
      }
    }));
  },
  setLicenseSnapshot(payload: {
    activationCode?: string;
    status?: "unknown" | "active" | "inactive" | "expired";
    remainingQuota?: number | null;
  }): void {
    const hasRemainingQuota = Object.prototype.hasOwnProperty.call(payload, "remainingQuota");
    updateState((current) => ({
      ...current,
      licenseSlice: {
        activationCode: payload.activationCode ?? current.licenseSlice.activationCode,
        status: payload.status ?? current.licenseSlice.status,
        remainingQuota: hasRemainingQuota ? (payload.remainingQuota ?? null) : current.licenseSlice.remainingQuota
      }
    }));
  },
  setQuestionKey(questionKey: string): void {
    updateState((current) => ({
      ...current,
      rubricSlice: {
        ...current.rubricSlice,
        questionKey
      }
    }));
  },
  setExamId(examId: string): void {
    updateState((current) => ({
      ...current,
      rubricSlice: {
        ...current.rubricSlice,
        examId
      }
    }));
  },
  setExamName(examName: string): void {
    updateState((current) => ({
      ...current,
      rubricSlice: {
        ...current.rubricSlice,
        examName
      }
    }));
  },
  setRubricText(rubricText: string): void {
    updateState((current) => ({
      ...current,
      rubricSlice: {
        ...current.rubricSlice,
        rubricText
      }
    }));
  },
  setLatestGrading(latestGrading: LatestGrading): void {
    updateState((current) => ({
      ...current,
      gradingSlice: {
        ...current.gradingSlice,
        latestGrading
      }
    }));
  },
  setRecordSnapshot(payload: {
    totalCount?: number;
    lastSyncAt?: string | null;
  }): void {
    const hasLastSyncAt = Object.prototype.hasOwnProperty.call(payload, "lastSyncAt");
    updateState((current) => ({
      ...current,
      recordSlice: {
        totalCount: payload.totalCount ?? current.recordSlice.totalCount,
        lastSyncAt: hasLastSyncAt ? (payload.lastSyncAt ?? null) : current.recordSlice.lastSyncAt
      }
    }));
  },
  setSettingsSnapshot(payload: {
    provider?: string;
    modelName?: string;
    gradingMode?: "assist" | "auto";
  }): void {
    updateState((current) => ({
      ...current,
      settingsSlice: {
        provider: payload.provider ?? current.settingsSlice.provider,
        modelName: payload.modelName ?? current.settingsSlice.modelName,
        gradingMode: payload.gradingMode ?? current.settingsSlice.gradingMode
      }
    }));
  },
  setActiveTabContext(activeTabContext: ActiveTabContext | null): void {
    updateState((current) => ({
      ...current,
      sessionSlice: {
        ...current.sessionSlice,
        activeTabContext
      }
    }));
  },
  setLastPageContext(lastPageContext: PageContextPayload | null): void {
    updateState((current) => ({
      ...current,
      sessionSlice: {
        ...current.sessionSlice,
        lastPageContext
      }
    }));
  }
};
