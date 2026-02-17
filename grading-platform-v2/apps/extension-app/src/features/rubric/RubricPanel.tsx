import { useEffect, useMemo, useRef, useState } from "react";
import { useRubricApi } from "./hooks/useRubricApi";
import {
  GRADE_OPTIONS,
  SUBJECT_OPTIONS,
  useRubricForm
} from "./hooks/useRubricForm";
import type { EntryIntent, ViewState } from "./types";
import { buildRubricResultPreview, parseScore } from "./utils/rubric-parser";
import { RubricGeneratingView } from "./views/RubricGeneratingView";
import { RubricInputView } from "./views/RubricInputView";
import { RubricResultView } from "./views/RubricResultView";

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

const GENERATION_MESSAGES = [
  "正在识别题干结构...",
  "正在提取采分点与关键词...",
  "正在推断评分策略...",
  "正在生成可保存细则..."
] as const;

export const RubricPanel = ({
  questionKey,
  onQuestionKeyChange,
  examId,
  onExamIdChange: _onExamIdChange,
  rubricText,
  onRubricTextChange,
  initialView,
  entryIntent = "input",
  onOpenSettings
}: RubricPanelProps) => {
  const resolvedInitialView: ViewState = initialView
    ? (initialView === "input" || initialView === "generating" || initialView === "result" ? initialView : "input")
    : "input";

  const [viewState, setViewState] = useState<ViewState>(resolvedInitialView);
  const [generationStep, setGenerationStep] = useState(0);
  const entryEffectAppliedRef = useRef(false);
  const loadSummariesRef = useRef<(() => Promise<void>) | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const questionImageRef = useRef<HTMLInputElement>(null);
  const answerImageRef = useRef<HTMLInputElement>(null);

  const form = useRubricForm();
  const api = useRubricApi({
    questionKey,
    examId,
    rubricText,
    onQuestionKeyChange,
    onRubricTextChange,
    setViewState,
    examName: form.examName,
    grade: form.grade,
    subject: form.subject,
    questionType: form.questionType,
    totalScore: form.totalScore,
    customRules: form.customRules,
    questionImage: form.questionImage,
    answerImage: form.answerImage
  });

  useEffect(() => {
    loadSummariesRef.current = api.loadSummaries;
  }, [api.loadSummaries]);

  const normalizedQuestionKey = useMemo(() => questionKey.trim(), [questionKey]);

  const generationProgress = useMemo(() => {
    return ((generationStep + 1) / GENERATION_MESSAGES.length) * 100;
  }, [generationStep]);

  const resultPreview = useMemo(() => {
    return buildRubricResultPreview({
      rubricText,
      fallbackQuestionKey: normalizedQuestionKey,
      fallbackSubject: form.subject,
      fallbackQuestionType: form.questionType,
      fallbackScore: parseScore(form.totalScore)
    });
  }, [form.questionType, form.subject, form.totalScore, normalizedQuestionKey, rubricText]);

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

  useEffect(() => {
    if (entryEffectAppliedRef.current) {
      return;
    }

    entryEffectAppliedRef.current = true;

    if (entryIntent === "list") {
      void loadSummariesRef.current?.();
      setViewState("input");
      return;
    }

    if (entryIntent !== "import") {
      setViewState("input");
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

  const statusMessage = api.successMessage
    ? <p className="classic-rubric-banner classic-rubric-banner-success">{api.successMessage}</p>
    : api.errorMessage
      ? <p className="classic-rubric-banner classic-rubric-banner-error">{api.errorMessage}</p>
      : null;

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
        busy={api.busy}
        examName={form.examName}
        grade={form.grade}
        subject={form.subject}
        questionType={form.questionType}
        questionKey={questionKey}
        totalScore={form.totalScore}
        specialRulesText={form.specialRulesText}
        questionImage={form.questionImage}
        answerImage={form.answerImage}
        gradeOptions={GRADE_OPTIONS}
        subjectOptions={SUBJECT_OPTIONS}
        questionTypeOptions={form.questionTypeOptions}
        importInputRef={importInputRef}
        questionImageRef={questionImageRef}
        answerImageRef={answerImageRef}
        hasGeneratedResult={Boolean(rubricText.trim())}
        resultPreview={resultPreview}
        lifecycleStatus={api.lifecycleStatus}
        onBack={() => setViewState(rubricText.trim() ? "result" : "input")}
        onOpenSettings={onOpenSettings}
        onClear={() => {
          form.handleClearInput();
          api.resetMessage();
        }}
        onGenerate={() => {
          void api.handleGenerate();
        }}
        onOpenResultPreview={() => setViewState("result")}
        onExamNameChange={form.setExamName}
        onGradeChange={form.setGrade}
        onSubjectChange={form.setSubject}
        onQuestionTypeChange={form.setQuestionType}
        onQuestionKeyChange={onQuestionKeyChange}
        onTotalScoreChange={form.setTotalScore}
        onSpecialRulesChange={form.setSpecialRulesText}
        onAppendSpecialRule={form.appendSpecialRule}
        onQuestionImageChange={(event) => {
          void form.handleImageUpload("question", api.setErrorMessage)(event);
        }}
        onAnswerImageChange={(event) => {
          void form.handleImageUpload("answer", api.setErrorMessage)(event);
        }}
        onRemoveQuestionImage={() => form.setQuestionImage(null)}
        onRemoveAnswerImage={() => form.setAnswerImage(null)}
        onImportJson={(event) => {
          void api.handleImportJson(event);
        }}
      />
    );
  }

  return (
    <RubricResultView
      statusMessage={statusMessage}
      rubricText={rubricText}
      resultPreview={resultPreview}
      lifecycleStatus={api.lifecycleStatus}
      busy={api.busy}
      onBackInput={() => setViewState("input")}
      onOpenList={() => {
        void api.loadSummaries();
        setViewState("input");
      }}
      onOpenSettings={onOpenSettings}
      onRegenerate={() => setViewState("input")}
      onRubricTextChange={onRubricTextChange}
      onSave={(nextRubricText) => {
        void api.handleSave(nextRubricText);
      }}
    />
  );
};
