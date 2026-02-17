import { useCallback, useRef, useState } from "react";

export type GradingControllerStatus = "idle" | "scanning" | "grading" | "review" | "applying" | "paused" | "error";
type RunningMode = "assist" | "auto" | null;

type UseGradingControllerParams = {
  onScanPage: () => Promise<{ signature?: string }>;
  onEvaluate: () => Promise<{ score: number }>;
  onApply: (score: number, autoSubmit: boolean) => Promise<void>;
  autoSubmitDelayMs?: number;
  maxDuplicateLimit?: number;
  maxConsecutiveErrors?: number;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export const useGradingController = ({
  onScanPage,
  onEvaluate,
  onApply,
  autoSubmitDelayMs = 1500,
  maxDuplicateLimit = 2,
  maxConsecutiveErrors = 3
}: UseGradingControllerParams) => {
  const [status, setStatus] = useState<GradingControllerStatus>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [mode, setMode] = useState<RunningMode>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const lastSignatureRef = useRef<string | null>(null);
  const duplicateCountRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);

  const resetTransientState = useCallback(() => {
    setError(null);
    setStep(0);
    setPendingScore(null);
    consecutiveErrorsRef.current = 0;
  }, []);

  const runAssistRound = useCallback(async (): Promise<void> => {
    setStatus("scanning");
    setStep(1);
    const scan = await onScanPage();
    if (scan.signature && scan.signature === lastSignatureRef.current) {
      duplicateCountRef.current += 1;
      if (duplicateCountRef.current > maxDuplicateLimit) {
        throw new Error("检测到连续重复页面，已停止本轮批改");
      }
    } else {
      duplicateCountRef.current = 0;
      lastSignatureRef.current = scan.signature ?? null;
    }

    setStatus("grading");
    setStep(2);
    const evaluate = await onEvaluate();
    setPendingScore(evaluate.score);
    setStatus("review");
    setStep(3);
  }, [maxDuplicateLimit, onEvaluate, onScanPage]);

  const runAutoRound = useCallback(async (): Promise<void> => {
    setStatus("scanning");
    setStep(1);
    const scan = await onScanPage();
    if (scan.signature && scan.signature === lastSignatureRef.current) {
      duplicateCountRef.current += 1;
      if (duplicateCountRef.current > maxDuplicateLimit) {
        throw new Error("检测到连续重复页面，自动模式已熔断");
      }
    } else {
      duplicateCountRef.current = 0;
      lastSignatureRef.current = scan.signature ?? null;
    }

    setStatus("grading");
    setStep(2);
    const evaluate = await onEvaluate();

    setStatus("applying");
    setStep(3);
    await onApply(evaluate.score, true);

    setStatus("review");
    setStep(4);
    setCycleCount((current) => current + 1);
  }, [maxDuplicateLimit, onApply, onEvaluate, onScanPage]);

  const startAssist = useCallback(async (): Promise<void> => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    pausedRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setMode("assist");
    resetTransientState();

    try {
      await runAssistRound();
      runningRef.current = false;
      setIsRunning(false);
    } catch (err) {
      runningRef.current = false;
      setIsRunning(false);
      setStatus("error");
      setError(err instanceof Error ? err.message : "辅助模式批改失败");
    }
  }, [resetTransientState, runAssistRound]);

  const startAuto = useCallback(async (): Promise<void> => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    pausedRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setMode("auto");
    resetTransientState();

    while (runningRef.current) {
      if (pausedRef.current) {
        await sleep(120);
        continue;
      }

      try {
        await runAutoRound();
        consecutiveErrorsRef.current = 0;
        await sleep(autoSubmitDelayMs);
      } catch (err) {
        consecutiveErrorsRef.current += 1;
        setStatus("error");
        setError(err instanceof Error ? err.message : "自动模式批改失败");

        if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
          runningRef.current = false;
          setIsRunning(false);
          break;
        }

        await sleep(autoSubmitDelayMs);
      }
    }
  }, [autoSubmitDelayMs, maxConsecutiveErrors, resetTransientState, runAutoRound]);

  const stop = useCallback((): void => {
    runningRef.current = false;
    pausedRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setStatus("idle");
    setMode(null);
    setPendingScore(null);
  }, []);

  const pause = useCallback((): void => {
    if (!runningRef.current || mode !== "auto") {
      return;
    }

    pausedRef.current = true;
    setIsPaused(true);
    setStatus("paused");
  }, [mode]);

  const resume = useCallback((): void => {
    if (!runningRef.current || mode !== "auto") {
      return;
    }

    pausedRef.current = false;
    setIsPaused(false);
    setStatus("scanning");
  }, [mode]);

  const confirmApply = useCallback(async (): Promise<void> => {
    if (pendingScore === null) {
      throw new Error("当前没有待确认的分数");
    }

    setStatus("applying");
    await onApply(pendingScore, false);
    setPendingScore(null);
    setStatus("review");
  }, [onApply, pendingScore]);

  const retry = useCallback(async (): Promise<void> => {
    setError(null);
    if (mode === "auto") {
      runningRef.current = false;
      await startAuto();
      return;
    }

    await startAssist();
  }, [mode, startAssist, startAuto]);

  return {
    status,
    step,
    error,
    cycleCount,
    mode,
    pendingScore,
    startAssist,
    startAuto,
    stop,
    pause,
    resume,
    confirmApply,
    retry,
    isRunning,
    isPaused
  };
};
