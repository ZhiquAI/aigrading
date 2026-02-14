import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteRubricByQuestionKey,
  fetchRubricByQuestionKey,
  fetchRubricSummaries,
  generateRubric,
  standardizeRubric,
  type RubricLifecycleStatus,
  type RubricSummaryDTO,
  upsertRubric
} from "../../lib/api";
import type { RubricResultPoint, RubricResultPreview } from "./types";
import { RubricGeneratingView } from "./views/RubricGeneratingView";
import { RubricInputView } from "./views/RubricInputView";
import { RubricListView } from "./views/RubricListView";
import { RubricResultView } from "./views/RubricResultView";
import { RubricWelcomeView } from "./views/RubricWelcomeView";

type RubricPanelProps = {
  questionKey: string;
  onQuestionKeyChange: (value: string) => void;
  examId: string;
  onExamIdChange: (value: string) => void;
  rubricText: string;
  onRubricTextChange: (value: string) => void;
  initialView?: ViewState;
  entryIntent?: EntryIntent;
  onOpenSettings?: () => void;
};

type ViewState = "welcome" | "input" | "list" | "generating" | "result";
type EntryIntent = "input" | "list" | "import";

const GENERATION_MESSAGES = [
  "正在识别题干结构...",
  "正在提取采分点与关键词...",
  "正在推断评分策略...",
  "正在生成可保存细则..."
] as const;

const GRADE_OPTIONS = ["初一", "初二", "初三", "高一", "高二", "高三"] as const;
const SUBJECT_OPTIONS = ["历史", "语文", "英语", "数学", "政治", "地理", "生物"] as const;
const QUESTION_TYPE_BY_SUBJECT: Record<string, readonly string[]> = {
  历史: ["选择题", "材料题", "论述题"],
  语文: ["选择题", "阅读题", "作文题"],
  英语: ["选择题", "完形填空", "阅读题", "写作题"],
  数学: ["选择题", "填空题", "解答题"],
  政治: ["选择题", "辨析题", "材料题"],
  地理: ["选择题", "读图题", "综合题"],
  生物: ["选择题", "实验题", "材料题"]
};
const DEFAULT_QUESTION_TYPES: readonly string[] = ["选择题", "材料题"];

const parseRubricInput = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请先输入 Rubric JSON 或文本内容");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

const toPrettyString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseScore = (raw: string): number | undefined => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.round(parsed);
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
};

const extractQuestionKey = (rubric: unknown): string | undefined => {
  if (!rubric || typeof rubric !== "object") {
    return undefined;
  }

  const payload = rubric as {
    metadata?: { questionId?: unknown };
    questionKey?: unknown;
    questionId?: unknown;
  };

  const metadataKey = typeof payload.metadata?.questionId === "string"
    ? payload.metadata.questionId.trim()
    : "";

  if (metadataKey) {
    return metadataKey;
  }

  const questionKey = typeof payload.questionKey === "string"
    ? payload.questionKey.trim()
    : "";

  if (questionKey) {
    return questionKey;
  }

  const questionId = typeof payload.questionId === "string"
    ? payload.questionId.trim()
    : "";

  return questionId || undefined;
};

const formatSummarySubline = (item: RubricSummaryDTO): string => {
  const left = item.pointCount > 0 ? `${item.pointCount} 点` : "暂无要点";
  const right = item.totalScore > 0 ? `${item.totalScore} 分` : "未设分值";
  return `${left} · ${right}`;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const strategyLabelMap: Record<string, string> = {
  point_accumulation: "按点给分",
  sequential_logic: "步骤给分",
  rubric_matrix: "等级矩阵",
  standard: "标准模式",
  all: "全点命中",
  weighted: "按权重累计",
  pick_n: "任答N点"
};

const normalizePoint = (
  point: Record<string, unknown>,
  index: number,
  segmentLabel?: string
): RubricResultPoint | null => {
  const content = firstText(point.content, point.standard, point.name);
  if (!content) {
    return null;
  }

  const scoreValue = Number(point.score);
  const score = Number.isFinite(scoreValue) ? scoreValue : 0;

  const keywords = Array.isArray(point.keywords)
    ? point.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id: firstText(point.id) || `p-${index + 1}`,
    questionSegment: firstText(point.questionSegment, segmentLabel) || "得分点",
    content,
    score,
    keywords,
  };
};

const buildRubricResultPreview = (input: {
  rubricText: string;
  fallbackQuestionKey: string;
  fallbackSubject: string;
  fallbackQuestionType: string;
  fallbackScore?: number;
}): RubricResultPreview => {
  const fallbackQuestionId = input.fallbackQuestionKey || "未命名题目";
  const fallbackTitle = `${input.fallbackSubject} ${input.fallbackQuestionType}`.trim() || "AI 生成评分细则";
  const fallback: RubricResultPreview = {
    title: fallbackTitle,
    questionId: fallbackQuestionId,
    subject: input.fallbackSubject || "-",
    questionType: input.fallbackQuestionType || "-",
    strategyLabel: "标准模式",
    totalScore: input.fallbackScore ?? 0,
    points: []
  };

  const trimmed = input.rubricText.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const root = toRecord(parsed);
    if (!root) {
      return fallback;
    }

    const metadata = toRecord(root.metadata) ?? {};
    const content = toRecord(root.content) ?? {};
    const directPoints = [
      ...toRecordList(root.answerPoints),
      ...toRecordList(content.points),
      ...toRecordList(content.steps)
    ];
    const segmentPoints = toRecordList(content.segments).flatMap((segment) => {
      const segmentTitle = firstText(segment.title, segment.name, segment.id);
      const segmentContent = toRecord(segment.content) ?? {};
      const points = [
        ...toRecordList(segmentContent.points),
        ...toRecordList(segmentContent.steps)
      ];
      return points.map((point, index) => normalizePoint(point, index, segmentTitle)).filter((item): item is RubricResultPoint => Boolean(item));
    });

    const points = [
      ...directPoints.map((point, index) => normalizePoint(point, index)).filter((item): item is RubricResultPoint => Boolean(item)),
      ...segmentPoints
    ];

    const pointsScore = points.reduce((sum, point) => sum + (Number.isFinite(point.score) ? point.score : 0), 0);
    const totalScore = (() => {
      const candidates = [
        Number(root.totalScore),
        Number(content.totalScore),
        Number(metadata.totalScore),
        pointsScore,
        input.fallbackScore
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
          return candidate;
        }
      }
      return 0;
    })();

    const rawStrategy = firstText(metadata.strategyType, root.strategyType, root.scoringStrategy);

    return {
      title: firstText(metadata.title) || fallbackTitle,
      questionId: firstText(metadata.questionId, root.questionId, root.questionKey) || fallbackQuestionId,
      subject: firstText(metadata.subject) || input.fallbackSubject || "-",
      questionType: firstText(metadata.questionType) || input.fallbackQuestionType || "-",
      strategyLabel: rawStrategy ? (strategyLabelMap[rawStrategy] ?? rawStrategy) : fallback.strategyLabel,
      totalScore,
      points
    };
  } catch {
    return fallback;
  }
};

export const RubricPanel = ({
  questionKey,
  onQuestionKeyChange,
  examId,
  onExamIdChange,
  rubricText,
  onRubricTextChange,
  initialView,
  entryIntent = "input",
  onOpenSettings
}: RubricPanelProps) => {
  const resolvedInitialView: ViewState = initialView
    ?? (entryIntent === "list" ? "list" : "input");
  const [viewState, setViewState] = useState<ViewState>(resolvedInitialView);
  const [lifecycleStatus, setLifecycleStatus] = useState<RubricLifecycleStatus>("draft");
  const [summaries, setSummaries] = useState<RubricSummaryDTO[]>([]);
  const [examName, setExamName] = useState("");
  const [grade, setGrade] = useState<string>("初三");
  const [totalScore, setTotalScore] = useState("10");
  const [subject, setSubject] = useState<string>("历史");
  const [questionType, setQuestionType] = useState<string>("选择题");
  const [specialRulesText, setSpecialRulesText] = useState("");
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [standardizedMarkdown, setStandardizedMarkdown] = useState("");
  const [generationStep, setGenerationStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const questionImageRef = useRef<HTMLInputElement>(null);
  const answerImageRef = useRef<HTMLInputElement>(null);
  const entryEffectAppliedRef = useRef(false);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const clearResultArtifacts = () => {
    setStandardizedMarkdown("");
  };

  const normalizedQuestionKey = useMemo(() => questionKey.trim(), [questionKey]);
  const questionTypeOptions = useMemo<readonly string[]>(() => {
    const mapped = QUESTION_TYPE_BY_SUBJECT[subject];
    return mapped ?? DEFAULT_QUESTION_TYPES;
  }, [subject]);
  const customRules = useMemo(
    () => specialRulesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    [specialRulesText]
  );
  const generationProgress = useMemo(() => {
    return ((generationStep + 1) / GENERATION_MESSAGES.length) * 100;
  }, [generationStep]);
  const resultPreview = useMemo(() => {
    return buildRubricResultPreview({
      rubricText,
      fallbackQuestionKey: normalizedQuestionKey,
      fallbackSubject: subject,
      fallbackQuestionType: questionType,
      fallbackScore: parseScore(totalScore)
    });
  }, [normalizedQuestionKey, questionType, rubricText, subject, totalScore]);

  useEffect(() => {
    if (!questionTypeOptions.includes(questionType)) {
      const fallback = questionTypeOptions[0];
      if (fallback) {
        setQuestionType(fallback);
      }
    }
  }, [questionType, questionTypeOptions]);

  useEffect(() => {
    if (viewState !== "generating") {
      setGenerationStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setGenerationStep((previous) => (previous + 1) % GENERATION_MESSAGES.length);
    }, 1100);

    return () => window.clearInterval(timer);
  }, [viewState]);

  const loadSummaries = async (): Promise<void> => {
    setLoadingList(true);
    resetMessage();

    try {
      const items = await fetchRubricSummaries({ examId: examId.trim() || undefined });
      setSummaries(items);
      if (items.length > 0) {
        setSuccessMessage(`已加载 ${items.length} 条评分细则`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取细则列表失败");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (entryEffectAppliedRef.current) {
      return;
    }

    entryEffectAppliedRef.current = true;

    if (entryIntent === "list") {
      setViewState("list");
      void loadSummaries();
      return;
    }

    if (entryIntent !== "import") {
      return;
    }

    setViewState("input");

    const triggerImportPicker = () => {
      importInputRef.current?.click();
    };

    triggerImportPicker();
    const timerId = window.setTimeout(triggerImportPicker, 80);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [entryIntent]);

  const handleEnterList = async (): Promise<void> => {
    setViewState("list");
    await loadSummaries();
  };

  const handleLoad = async (targetQuestionKey?: string): Promise<void> => {
    const key = (targetQuestionKey ?? normalizedQuestionKey).trim();
    if (!key) {
      setErrorMessage("请先填写题号 / questionKey");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const detail = await fetchRubricByQuestionKey(key);
      if (!detail) {
        onRubricTextChange("");
        setSuccessMessage("未找到对应评分细则");
        return;
      }

      onQuestionKeyChange(key);
      onRubricTextChange(toPrettyString(detail.rubric));
      setLifecycleStatus(detail.lifecycleStatus);
      clearResultArtifacts();
      setViewState("result");
      setSuccessMessage("评分细则加载成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取评分细则失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const parsed = parseRubricInput(rubricText);
      const result = await upsertRubric({
        questionKey: normalizedQuestionKey || undefined,
        rubric: parsed,
        examId: examId.trim() || null,
        lifecycleStatus
      });

      onQuestionKeyChange(result.questionKey);
      onRubricTextChange(toPrettyString(result.rubric));
      setLifecycleStatus(result.lifecycleStatus);
      setSuccessMessage(`评分细则已保存：${result.questionKey}`);
      setViewState("result");
      await loadSummaries();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存评分细则失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!normalizedQuestionKey) {
      setErrorMessage("请先填写题号 / questionKey");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      await deleteRubricByQuestionKey(normalizedQuestionKey);
      onRubricTextChange("");
      clearResultArtifacts();
      setSuccessMessage("评分细则已删除");
      await loadSummaries();
      setViewState("welcome");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除评分细则失败");
    } finally {
      setBusy(false);
    }
  };

  const handleImageUpload = (target: "question" | "answer") => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      if (target === "question") {
        setQuestionImage(dataUrl);
      } else {
        setAnswerImage(dataUrl);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "图片读取失败");
    } finally {
      event.target.value = "";
    }
  };

  const handleClearInput = (): void => {
    setExamName("");
    setGrade("初三");
    setSubject("历史");
    setQuestionType("选择题");
    setTotalScore("10");
    setSpecialRulesText("");
    setQuestionImage(null);
    setAnswerImage(null);
    resetMessage();
  };

  const handleGenerate = async (): Promise<void> => {
    if (!normalizedQuestionKey) {
      setErrorMessage("请先填写题号");
      return;
    }

    const parsedScore = parseScore(totalScore);
    if (!parsedScore) {
      setErrorMessage("请先填写有效总分");
      return;
    }

    if (!questionImage) {
      setErrorMessage("请先上传试题图片");
      return;
    }

    setBusy(true);
    resetMessage();
    clearResultArtifacts();
    setViewState("generating");

    try {
      const result = await generateRubric({
        questionImage,
        answerImage: answerImage ?? undefined,
        questionId: normalizedQuestionKey || undefined,
        subject: subject.trim() || undefined,
        questionType: questionType.trim() || undefined,
        totalScore: parsedScore,
        customRules: customRules.length > 0 ? customRules : undefined
      });

      const rubricCandidate = (
        result.rubric && typeof result.rubric === "object"
      ) ? {
        ...(result.rubric as Record<string, unknown>),
        metadata: {
          ...((result.rubric as { metadata?: Record<string, unknown> }).metadata ?? {}),
          questionId: normalizedQuestionKey,
          examName: examName.trim() || undefined,
          subject,
          grade,
          questionType
        }
      } : result.rubric;

      const rubricContent = toPrettyString(rubricCandidate);
      const nextQuestionKey = extractQuestionKey(rubricCandidate);

      onRubricTextChange(rubricContent);
      if (nextQuestionKey) {
        onQuestionKeyChange(nextQuestionKey);
      }

      setSuccessMessage(`评分细则生成完成（${result.provider}）`);
      setViewState("result");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成评分细则失败");
      setViewState("input");
    } finally {
      setBusy(false);
    }
  };

  const handleStandardize = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const payload = parseRubricInput(rubricText);
      const result = await standardizeRubric({
        rubric: typeof payload === "string" ? payload : (payload as Record<string, unknown>),
        maxScore: parseScore(totalScore)
      });

      setStandardizedMarkdown(result.rubric);
      setSuccessMessage(`标准化完成（${result.provider}）`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "标准化失败");
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const nextQuestionKey = extractQuestionKey(parsed);

      onRubricTextChange(toPrettyString(parsed));
      if (nextQuestionKey) {
        onQuestionKeyChange(nextQuestionKey);
      }
      setViewState("result");
      setSuccessMessage("已导入评分细则 JSON");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导入失败，仅支持 JSON");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  };

  const renderStatusMessage = () => {
    if (successMessage) {
      return <p className="legacy-rubric-banner legacy-rubric-banner-success">{successMessage}</p>;
    }

    if (errorMessage) {
      return <p className="legacy-rubric-banner legacy-rubric-banner-error">{errorMessage}</p>;
    }

    return null;
  };

  const statusMessage = renderStatusMessage();

  if (viewState === "welcome") {
    return (
      <RubricWelcomeView
        statusMessage={statusMessage}
        summaries={summaries}
        importInputRef={importInputRef}
        onStart={() => setViewState("input")}
        onImport={() => importInputRef.current?.click()}
        onEnterList={() => {
          void handleEnterList();
        }}
        onLoad={(questionId) => {
          void handleLoad(questionId);
        }}
        onImportJson={(event) => {
          void handleImportJson(event);
        }}
        formatSummarySubline={formatSummarySubline}
      />
    );
  }

  if (viewState === "list") {
    return (
      <RubricListView
        statusMessage={statusMessage}
        examId={examId}
        loadingList={loadingList}
        summaries={summaries}
        onBack={() => setViewState("welcome")}
        onRefresh={() => {
          void loadSummaries();
        }}
        onLoad={(questionId) => {
          void handleLoad(questionId);
        }}
        onExamIdChange={onExamIdChange}
        formatSummarySubline={formatSummarySubline}
      />
    );
  }

  if (viewState === "generating") {
    return (
      <RubricGeneratingView
        generationStep={generationStep}
        generationProgress={generationProgress}
        generationMessages={GENERATION_MESSAGES}
        onBack={() => setViewState("input")}
      />
    );
  }

  if (viewState === "input") {
    return (
      <RubricInputView
        statusMessage={statusMessage}
        busy={busy}
        examName={examName}
        grade={grade}
        subject={subject}
        questionType={questionType}
        questionKey={questionKey}
        totalScore={totalScore}
        specialRulesText={specialRulesText}
        questionImage={questionImage}
        answerImage={answerImage}
        gradeOptions={GRADE_OPTIONS}
        subjectOptions={SUBJECT_OPTIONS}
        questionTypeOptions={questionTypeOptions}
        importInputRef={importInputRef}
        questionImageRef={questionImageRef}
        answerImageRef={answerImageRef}
        onBack={() => setViewState("welcome")}
        onOpenSettings={onOpenSettings}
        onClear={handleClearInput}
        onGenerate={() => {
          void handleGenerate();
        }}
        onExamNameChange={setExamName}
        onGradeChange={setGrade}
        onSubjectChange={setSubject}
        onQuestionTypeChange={setQuestionType}
        onQuestionKeyChange={onQuestionKeyChange}
        onTotalScoreChange={setTotalScore}
        onSpecialRulesChange={setSpecialRulesText}
        onQuestionImageChange={(event) => {
          void handleImageUpload("question")(event);
        }}
        onAnswerImageChange={(event) => {
          void handleImageUpload("answer")(event);
        }}
        onRemoveQuestionImage={() => setQuestionImage(null)}
        onRemoveAnswerImage={() => setAnswerImage(null)}
        onImportJson={(event) => {
          void handleImportJson(event);
        }}
      />
    );
  }

  return (
    <RubricResultView
      statusMessage={statusMessage}
      resultPreview={resultPreview}
      lifecycleStatus={lifecycleStatus}
      busy={busy}
      onBackInput={() => setViewState("input")}
      onOpenList={() => setViewState("list")}
      onOpenSettings={onOpenSettings}
      onRegenerate={() => setViewState("input")}
      onSave={() => {
        void handleSave();
      }}
    />
  );
};
