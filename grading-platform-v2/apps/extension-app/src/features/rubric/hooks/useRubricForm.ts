import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { fileToDataUrl } from "../utils/rubric-parser";

export const GRADE_OPTIONS = ["初一", "初二", "初三", "高一", "高二", "高三"] as const;
export const SUBJECT_OPTIONS = ["历史", "语文", "英语", "数学", "政治", "地理", "生物"] as const;
export const QUESTION_TYPE_BY_SUBJECT: Record<string, readonly string[]> = {
  历史: ["选择题", "材料题", "论述题"],
  语文: ["选择题", "阅读题", "作文题"],
  英语: ["选择题", "完形填空", "阅读题", "写作题"],
  数学: ["选择题", "填空题", "解答题"],
  政治: ["选择题", "辨析题", "材料题"],
  地理: ["选择题", "读图题", "综合题"],
  生物: ["选择题", "实验题", "材料题"]
};

const DEFAULT_QUESTION_TYPES: readonly string[] = ["选择题", "材料题"];
const STORAGE_KEY = "rubric.form.preferences.v1";

type FormPreferenceSnapshot = {
  grade?: string;
  subject?: string;
  questionType?: string;
};

const loadPreferences = (): FormPreferenceSnapshot => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as FormPreferenceSnapshot;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

export const useRubricForm = () => {
  const preference = loadPreferences();

  const [examName, setExamName] = useState("");
  const [grade, setGrade] = useState<string>(preference.grade || "初三");
  const [subject, setSubject] = useState<string>(preference.subject || "历史");
  const [questionType, setQuestionType] = useState<string>(preference.questionType || "选择题");
  const [totalScore, setTotalScore] = useState("10");
  const [specialRulesText, setSpecialRulesText] = useState("");
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [answerImage, setAnswerImage] = useState<string | null>(null);

  const questionTypeOptions = useMemo<readonly string[]>(() => {
    const mapped = QUESTION_TYPE_BY_SUBJECT[subject];
    return mapped ?? DEFAULT_QUESTION_TYPES;
  }, [subject]);

  const customRules = useMemo(() => {
    return specialRulesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [specialRulesText]);

  useEffect(() => {
    if (!questionTypeOptions.includes(questionType)) {
      const fallback = questionTypeOptions[0];
      if (fallback) {
        setQuestionType(fallback);
      }
    }
  }, [questionType, questionTypeOptions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot: FormPreferenceSnapshot = {
      grade,
      subject,
      questionType
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [grade, subject, questionType]);

  const handleImageUpload = (target: "question" | "answer", onError: (message: string) => void) => {
    return async (event: ChangeEvent<HTMLInputElement>) => {
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
      } catch (error) {
        onError(error instanceof Error ? error.message : "图片读取失败");
      } finally {
        event.target.value = "";
      }
    };
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
  };

  const appendSpecialRule = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setSpecialRulesText((previous) => {
      const clean = previous.trim();
      return clean ? `${clean}\n${trimmed}` : trimmed;
    });
  };

  return {
    examName,
    grade,
    subject,
    questionType,
    totalScore,
    specialRulesText,
    questionImage,
    answerImage,
    questionTypeOptions,
    customRules,
    setExamName,
    setGrade,
    setSubject,
    setQuestionType,
    setTotalScore,
    setSpecialRulesText,
    setQuestionImage,
    setAnswerImage,
    handleImageUpload,
    handleClearInput,
    appendSpecialRule
  };
};
