import { useCallback, useState } from "react";
import {
  applyScoreToActiveTab,
  captureAnswerImageFromActiveTab,
  fetchActiveTabContext,
  fetchLatestPageContext,
  requestPageContextFromActiveTab,
  type ActiveTabContext,
  type PageContext
} from "../../../lib/extensionBridge";

export type ScanSnapshot = {
  signature: string;
  imageBase64: string;
  questionNo: string;
  captureMeta: string;
};

export const useGradingPageOps = () => {
  const [domBusy, setDomBusy] = useState(false);
  const [activeTabContext, setActiveTabContext] = useState<ActiveTabContext | null>(null);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [captureMeta, setCaptureMeta] = useState("");

  const refreshExtensionContext = useCallback(async (): Promise<void> => {
    setDomBusy(true);
    try {
      const [tabCtx, latestPageCtx] = await Promise.all([fetchActiveTabContext(), fetchLatestPageContext()]);
      setActiveTabContext(tabCtx);
      setPageContext(latestPageCtx);
    } finally {
      setDomBusy(false);
    }
  }, []);

  const pullContextFromPage = useCallback(async (): Promise<PageContext | null> => {
    setDomBusy(true);
    try {
      const payload = await requestPageContextFromActiveTab();
      if (payload) {
        setPageContext(payload);
      }
      return payload;
    } finally {
      setDomBusy(false);
    }
  }, []);

  const captureFromPage = useCallback(async (): Promise<ScanSnapshot> => {
    setDomBusy(true);
    try {
      const capture = await captureAnswerImageFromActiveTab();
      const nextCaptureMeta = `${capture.platform} | ${capture.elementTag} | ${capture.selector}`;
      setCaptureMeta(nextCaptureMeta);
      return {
        signature: `${capture.platform}:${capture.selector}:${capture.questionNo ?? "unknown"}`,
        imageBase64: capture.imageBase64,
        questionNo: capture.questionNo ?? "",
        captureMeta: nextCaptureMeta
      };
    } finally {
      setDomBusy(false);
    }
  }, []);

  const applyScore = useCallback(async (score: number, autoSubmit: boolean): Promise<{
    submitted: boolean;
    method: string;
  }> => {
    setDomBusy(true);
    try {
      const payload = await applyScoreToActiveTab({ score, autoSubmit });
      if (!payload.success) {
        throw new Error(payload.error ?? "回填失败");
      }

      return {
        submitted: Boolean(payload.submitted),
        method: payload.method ?? "unknown"
      };
    } finally {
      setDomBusy(false);
    }
  }, []);

  return {
    domBusy,
    activeTabContext,
    pageContext,
    captureMeta,
    setCaptureMeta,
    setPageContext,
    refreshExtensionContext,
    pullContextFromPage,
    captureFromPage,
    applyScore
  };
};
