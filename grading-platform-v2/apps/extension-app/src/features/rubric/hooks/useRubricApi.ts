import { useState, type ChangeEvent } from "react";
import {
  deleteRubricByQuestionKey,
  fetchRubricByQuestionKey,
  fetchRubricSummaries,
  generateRubric,
  standardizeRubric,
  type RubricLifecycleStatus,
  type RubricSummaryDTO,
  upsertRubric
} from "../../../lib/api";
import type { ViewState } from "../types";
import {
  extractQuestionKey,
  parseRubricInput,
  parseScore,
  toPrettyString
} from "../utils/rubric-parser";

const toV4QuestionType = (value: string): "single" | "mixed" => {
  const normalized = value.trim();
  if (!normalized) {
    return "mixed";
  }

  if (
    normalized.includes("选择")
    || normalized.includes("单选")
    || normalized.includes("多选")
    || normalized.includes("判断")
    || normalized.includes("填空")
  ) {
    return "single";
  }

  return "mixed";
};

type UseRubricApiArgs = {
  questionKey: string;
  examId: string;
  rubricText: string;
  onQuestionKeyChange: (value: string) => void;
  onRubricTextChange: (value: string) => void;
  setViewState: (value: ViewState) => void;
  examName: string;
  grade: string;
  subject: string;
  questionType: string;
  totalScore: string;
  customRules: string[];
  questionImage: string | null;
  answerImage: string | null;
};

export const useRubricApi = ({
  questionKey,
  examId,
  rubricText,
  onQuestionKeyChange,
  onRubricTextChange,
  setViewState,
  examName,
  grade,
  subject,
  questionType,
  totalScore,
  customRules,
  questionImage,
  answerImage
}: UseRubricApiArgs) => {
  const [lifecycleStatus, setLifecycleStatus] = useState<RubricLifecycleStatus>("draft");
  const [summaries, setSummaries] = useState<RubricSummaryDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [standardizedMarkdown, setStandardizedMarkdown] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedQuestionKey = questionKey.trim();

  const resetMessage = (): void => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const clearResultArtifacts = (): void => {
    setStandardizedMarkdown("");
  };

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

  const handleSave = async (nextRubricText?: string): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const sourceRubricText = typeof nextRubricText === "string"
        ? nextRubricText
        : rubricText;
      const parsed = parseRubricInput(sourceRubricText);

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
      setViewState("input");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除评分细则失败");
    } finally {
      setBusy(false);
    }
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

      const rubricCandidate = (() => {
        if (!(result.rubric && typeof result.rubric === "object")) {
          return result.rubric;
        }

        const source = result.rubric as Record<string, unknown>;
        const metadata = (source.metadata && typeof source.metadata === "object")
          ? source.metadata as Record<string, unknown>
          : {};

        const isV4 = source.version === "4.0";
        const nextMetadata: Record<string, unknown> = {
          ...metadata,
          questionId: normalizedQuestionKey,
          examName: examName.trim() || undefined,
          subject,
          grade
        };

        if (isV4) {
          nextMetadata.questionType = metadata.questionType === "single" || metadata.questionType === "mixed"
            ? metadata.questionType
            : toV4QuestionType(questionType);
        } else {
          nextMetadata.questionType = questionType;
        }

        return {
          ...source,
          metadata: nextMetadata
        };
      })();

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

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
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

  return {
    lifecycleStatus,
    summaries,
    busy,
    loadingList,
    standardizedMarkdown,
    errorMessage,
    successMessage,
    setErrorMessage,
    setSuccessMessage,
    handleGenerate,
    handleSave,
    handleDelete,
    handleLoad,
    handleStandardize,
    handleImportJson,
    loadSummaries,
    resetMessage,
    clearResultArtifacts
  };
};
