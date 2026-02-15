type RuntimeResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string | null;
};

export type ActiveTabContext = {
  tabId: number | null;
  url: string;
  title: string;
  supported: boolean;
};

export type PageContext = {
  sourceTabId?: number | null;
  reason?: string;
  href?: string;
  title?: string;
  platform?: string;
  markingPaperId?: string | null;
  questionNo?: string | null;
  questionKey?: string;
  timestamp?: string;
};

export type CaptureAnswerImageResult = {
  imageBase64: string;
  elementTag: string;
  selector: string;
  platform: string;
  questionNo?: string | null;
  questionKey?: string;
  href?: string;
};

export type ApplyScoreResult = {
  success: boolean;
  method?: string;
  submitted?: boolean;
  submitMethod?: string | null;
  score?: number;
  error?: string;
};

const getChromeRuntime = (): {
  sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
} | null => {
  const runtime = (
    globalThis as typeof globalThis & {
      chrome?: {
        runtime?: {
          sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
        };
      };
    }
  ).chrome?.runtime;

  return runtime ?? null;
};

const sendRuntimeMessage = <T>(message: unknown): Promise<T> => {
  const runtime = getChromeRuntime();
  if (!runtime?.sendMessage) {
    return Promise.reject(new Error("当前不在扩展运行环境中"));
  }

  return new Promise((resolve, reject) => {
    runtime.sendMessage?.(message, (response) => {
      const payload = response as RuntimeResponse<T> | undefined;
      if (!payload?.ok) {
        reject(new Error(payload?.error ?? "扩展消息调用失败"));
        return;
      }

      resolve(payload.data as T);
    });
  });
};

export const fetchActiveTabContext = async (): Promise<ActiveTabContext> => {
  return sendRuntimeMessage<ActiveTabContext>({ type: "GET_ACTIVE_TAB_CONTEXT" });
};

export const fetchLatestPageContext = async (): Promise<PageContext | null> => {
  return sendRuntimeMessage<PageContext | null>({ type: "GET_LAST_PAGE_CONTEXT" });
};

export const requestPageContextFromActiveTab = async (): Promise<PageContext | null> => {
  return sendRuntimeMessage<PageContext | null>({ type: "PAGE_CONTEXT_REQUEST" });
};

export const pingActiveTabContent = async (): Promise<PageContext> => {
  return sendRuntimeMessage<PageContext>({ type: "PING_ACTIVE_TAB_CONTENT" });
};

export const captureAnswerImageFromActiveTab = async (): Promise<CaptureAnswerImageResult> => {
  return sendRuntimeMessage<CaptureAnswerImageResult>({ type: "RUBRIC_DETECT_REQUEST" });
};

export const applyScoreToActiveTab = async (input: {
  score: number;
  autoSubmit?: boolean;
}): Promise<ApplyScoreResult> => {
  return sendRuntimeMessage<ApplyScoreResult>({
    type: "GRADE_APPLY_REQUEST",
    payload: {
      score: input.score,
      options: {
        autoSubmit: Boolean(input.autoSubmit)
      }
    }
  });
};
