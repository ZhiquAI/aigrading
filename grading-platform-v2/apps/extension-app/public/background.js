const SIDEPANEL_PATH = "index.html";
const SUPPORTED_HOST_RE = [/\.zhixue\.com$/i, /\.haofenshu\.com$/i, /\.7net\.cc$/i];

const isSupportedTabUrl = (rawUrl) => {
  if (!rawUrl) {
    return false;
  }

  try {
    const url = new URL(rawUrl);
    return SUPPORTED_HOST_RE.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
};

const setPanelBehavior = async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("[extension-app] failed to set side panel behavior", error);
  }
};

const setOptionsForTab = async (tabId) => {
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: SIDEPANEL_PATH,
      enabled: true
    });
  } catch (error) {
    console.error("[extension-app] failed to set side panel options", error);
  }
};

const isWebTabUrl = (rawUrl) => {
  return typeof rawUrl === "string" && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"));
};

const getActiveTab = async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    throw new Error("active tab not found");
  }

  return activeTab;
};

const isReceivingEndMissing = (error) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Receiving end does not exist");
};

const sendMessageToTab = async (tabId, message) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response ?? null);
    });
  });
};

const ensureContentScriptInjected = async (tabId, tabUrl) => {
  if (!isWebTabUrl(tabUrl)) {
    throw new Error("当前页面不支持内容脚本注入，请切换到普通网页后重试");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
};

const unwrapContentResponse = (response) => {
  if (!response || typeof response !== "object") {
    return response ?? null;
  }

  if (response.ok === false) {
    throw new Error(response.error || "content script returned failed result");
  }

  if (Object.prototype.hasOwnProperty.call(response, "data")) {
    return response.data ?? null;
  }

  return response;
};

const sendMessageToActiveTab = async (message) => {
  const tab = await getActiveTab();

  try {
    const response = await sendMessageToTab(tab.id, message);
    return unwrapContentResponse(response);
  } catch (error) {
    if (!isReceivingEndMissing(error)) {
      throw error;
    }

    await ensureContentScriptInjected(tab.id, tab.url);
    const retryResponse = await sendMessageToTab(tab.id, message);
    return unwrapContentResponse(retryResponse);
  }
};

const syncActiveTabPanelState = async () => {
  try {
    const activeTab = await getActiveTab();
    await setOptionsForTab(activeTab.id);
  } catch (error) {
    console.error("[extension-app] failed to sync active tab state", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void setPanelBehavior();
  void syncActiveTabPanelState();
});

chrome.runtime.onStartup.addListener(() => {
  void setPanelBehavior();
  void syncActiveTabPanelState();
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "loading" && info.status !== "complete") {
    return;
  }

  void setOptionsForTab(tabId);
});

chrome.tabs.onActivated.addListener(() => {
  void syncActiveTabPanelState();
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    return;
  }

  void chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((error) => console.error("[extension-app] failed to open side panel", error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  const payload = message.payload && typeof message.payload === "object" ? message.payload : {};

  if (message.type === "GET_ACTIVE_TAB_CONTEXT") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const [activeTab] = tabs;
        sendResponse({
          ok: true,
          data: {
            tabId: activeTab?.id ?? null,
            url: activeTab?.url ?? "",
            title: activeTab?.title ?? "",
            supported: isSupportedTabUrl(activeTab?.url ?? "")
          }
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to query active tab"
        });
      });
    return true;
  }

  if (message.type === "REQUEST_PAGE_CONTEXT_FROM_ACTIVE_TAB" || message.type === "PAGE_CONTEXT_REQUEST") {
    sendMessageToActiveTab({ type: "PAGE_CONTEXT_REQUEST" })
      .then(async (contentPayload) => {
        const store = await chrome.storage.session.get("lastPageContext");
        sendResponse({ ok: true, data: contentPayload ?? store.lastPageContext ?? null });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to request page context"
        });
      });
    return true;
  }

  if (message.type === "CAPTURE_ANSWER_IMAGE_FROM_ACTIVE_TAB" || message.type === "RUBRIC_DETECT_REQUEST") {
    sendMessageToActiveTab({ type: "RUBRIC_DETECT_REQUEST", payload })
      .then((payload) => {
        sendResponse({ ok: true, data: payload });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to capture image"
        });
      });
    return true;
  }

  if (message.type === "APPLY_SCORE_TO_ACTIVE_TAB" || message.type === "GRADE_APPLY_REQUEST") {
    const score = Number(payload.score ?? message.score);
    if (!Number.isFinite(score)) {
      sendResponse({ ok: false, error: "invalid score" });
      return;
    }

    sendMessageToActiveTab({
          type: "GRADE_APPLY_REQUEST",
          payload: {
            score,
            options: payload.options ?? message.options ?? {}
          }
        })
      .then((payload) => {
        sendResponse({ ok: true, data: payload });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to apply score"
        });
      });
    return true;
  }

  if (message.type === "PING_ACTIVE_TAB_CONTENT") {
    sendMessageToActiveTab({ type: "PING_CONTENT" })
      .then((payload) => {
        sendResponse({ ok: true, data: payload });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to ping content"
        });
      });
    return true;
  }

  if (message.type === "PAGE_CONTEXT_UPDATED" || message.type === "PAGE_CONTEXT_RESPONSE") {
    const sourceTabId = sender.tab?.id ?? null;
    const pageContextPayload = {
      sourceTabId,
      ...message.payload
    };

    void chrome.storage.session.set({ lastPageContext: pageContextPayload });
    void chrome.runtime.sendMessage({ type: "PAGE_CONTEXT_BROADCAST", payload: pageContextPayload });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_LAST_PAGE_CONTEXT") {
    chrome.storage.session
      .get("lastPageContext")
      .then((result) => {
        sendResponse({ ok: true, data: result.lastPageContext ?? null });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "failed to get page context"
        });
      });
    return true;
  }
});
