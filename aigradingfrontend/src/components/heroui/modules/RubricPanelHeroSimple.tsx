import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Image, Progress } from '@heroui/react';
import { BookTemplate, ChevronLeft, FileImage, FileUp, ImagePlus, Loader2, Settings, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { generateRubricFromImages } from '@/services/rubric-service';
import type { RubricJSONV3 } from '@/types/rubric-v3';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import { Tab } from '@/types';
import RubricResultView from '@/src/components/v2/views/RubricResultView';
import RubricListView, { type RubricTemplateSeed } from '@/src/components/v2/views/RubricListView';
import {
  getQuestionTypeOptions,
  getSubjectOptions,
  inferStrategyTypeByQuestionType,
  normalizeQuestionTypeValue,
  normalizeSubjectValue,
} from '@/src/components/v2/views/rubric-config';

type ViewState = 'welcome' | 'input' | 'list' | 'generating' | 'result';

const GENERATION_MESSAGES = [
  '正在识别题干结构...',
  '正在提取采分点与关键词...',
  '正在自动拆分评分条目...',
  '正在生成可保存细则...',
];
const GRADE_OPTIONS = ['初一', '初二', '初三', '高一', '高二', '高三'];

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('图片读取失败'));
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

const RubricPanelHeroSimple: React.FC = () => {
  const {
    exams,
    activeExamId,
    rubricLibrary,
    rubricData,
    quota,
    setActiveTab,
    setActiveExamId,
    setRubricConfig,
    saveRubric,
    loadConfiguredQuestions,
  } = useAppStore();

  const subjectOptions = getSubjectOptions();
  const defaultSubject = subjectOptions[0]?.value || '历史';
  const defaultQuestionType = getQuestionTypeOptions(defaultSubject)[0]?.value || '材料题';

  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [inputBackTarget, setInputBackTarget] = useState<'welcome' | 'list'>('welcome');
  const [resultBackTarget, setResultBackTarget] = useState<'welcome' | 'input' | 'list'>('input');
  const [generatedRubric, setGeneratedRubric] = useState<RubricJSONV3 | null>(null);
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);

  const [examName, setExamName] = useState('');
  const [grade, setGrade] = useState('初三');
  const [subject, setSubject] = useState(defaultSubject);
  const [questionType, setQuestionType] = useState(defaultQuestionType);
  const [questionNo, setQuestionNo] = useState('');
  const [totalScore, setTotalScore] = useState('');
  const [specialRulesText, setSpecialRulesText] = useState('');

  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [answerImage, setAnswerImage] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState(0);

  const questionImageRef = useRef<HTMLInputElement>(null);
  const answerImageRef = useRef<HTMLInputElement>(null);
  const specialRulesRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const generationRequestIdRef = useRef(0);

  const activeExamName = useMemo(
    () => exams.find((exam) => exam.id === activeExamId)?.name || '',
    [activeExamId, exams]
  );
  const resolvedExamName = useMemo(
    () => (examName || activeExamName || '').trim(),
    [activeExamName, examName]
  );

  const normalizedQuestionNo = questionNo.trim();
  const parsedTotalScore = useMemo(() => parsePositiveInt(totalScore), [totalScore]);
  const hasQuestionImage = Boolean(questionImage);
  const hasBasicInfo = normalizedQuestionNo.length > 0 && parsedTotalScore !== null;
  const customRules = useMemo(
    () => specialRulesText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    [specialRulesText]
  );
  const questionTypeOptions = useMemo(
    () => getQuestionTypeOptions(normalizeSubjectValue(subject)),
    [subject]
  );
  const configuredRubricCountLabel = useMemo(
    () => (rubricLibrary.length > 99 ? '99+' : String(rubricLibrary.length)),
    [rubricLibrary.length]
  );
  const recentRubrics = useMemo(() => rubricLibrary.slice(0, 2), [rubricLibrary]);

  const generationProgress = ((generationStep + 1) / GENERATION_MESSAGES.length) * 100;

  useEffect(() => {
    if (activeExamName && !examName.trim()) {
      setExamName(activeExamName);
    }
  }, [activeExamName, examName]);

  useEffect(() => {
    if (viewState !== 'generating') {
      setGenerationStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setGenerationStep((prev) => (prev + 1) % GENERATION_MESSAGES.length);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [viewState]);

  useEffect(() => {
    if (questionTypeOptions.some((item) => item.value === questionType)) return;
    const fallback = questionTypeOptions[0]?.value;
    if (fallback) {
      setQuestionType(fallback);
    }
  }, [questionType, questionTypeOptions]);

  useEffect(() => {
    const textarea = specialRulesRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [specialRulesText]);

  useEffect(() => {
    let title = '评分细则';
    if (viewState === 'input') title = '生成评分细则';
    if (viewState === 'list') title = '评分细则列表';
    if (viewState === 'generating') title = '正在生成细则';
    if (viewState === 'result') title = '细则核对';
    window.dispatchEvent(new CustomEvent('heroui:rubric-title', { detail: { title } }));
  }, [viewState]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('heroui:rubric-title', { detail: { title: '设置评分细则' } }));
    };
  }, []);

  const findExistingQuestionKey = useCallback((rubric: RubricJSONV3): string | null => {
    const targetQuestionId = (rubric.metadata.questionId || '').trim();
    const targetSubject = normalizeSubjectValue(rubric.metadata.subject || '');
    const targetExamId = rubric.metadata.examId || null;

    if (!targetQuestionId) return null;

    for (const item of rubricLibrary || []) {
      const existing = rubricData?.[item.id];
      if (!existing) continue;

      try {
        const normalized = coerceRubricToV3(existing).rubric;
        const sameQuestionId = (normalized.metadata.questionId || '').trim() === targetQuestionId;
        const sameSubject = normalizeSubjectValue(normalized.metadata.subject || '') === targetSubject;
        const sameExam = (normalized.metadata.examId || null) === targetExamId;
        if (sameQuestionId && sameSubject && sameExam) {
          return item.id;
        }
      } catch {
        continue;
      }
    }

    return null;
  }, [rubricData, rubricLibrary]);

  const buildManualQuestionKey = useCallback((rubric: RubricJSONV3): string => {
    const safeQuestionNo = (rubric.metadata.questionId || normalizedQuestionNo || 'unknown').trim() || 'unknown';
    const safeSubject = (rubric.metadata.subject || subject || 'unknown').trim() || 'unknown';
    const safeExam = (rubric.metadata.examId || activeExamId || 'noexam').trim() || 'noexam';
    return `manual:${safeExam}:${safeSubject}:${safeQuestionNo}`;
  }, [activeExamId, normalizedQuestionNo, subject]);

  const resetForm = useCallback(() => {
    setGrade('初三');
    setQuestionType(defaultQuestionType);
    setQuestionNo('');
    setTotalScore('');
    setSpecialRulesText('');
    setQuestionImage(null);
    setAnswerImage(null);
    setGeneratedRubric(null);
    setSelectedQuestionKey(null);
    setGenerationError(null);
    setViewState('input');
  }, [defaultQuestionType]);

  const openInput = useCallback((backTarget: 'welcome' | 'list') => {
    setInputBackTarget(backTarget);
    setGeneratedRubric(null);
    setGenerationError(null);
    setViewState('input');
  }, []);

  const handleExamNameChange = useCallback((value: string) => {
    setExamName(value);
    const matched = exams.find((exam) => exam.name.trim() === value.trim());
    setActiveExamId(matched?.id || null);
  }, [exams, setActiveExamId]);

  const handleImageUpload = useCallback((target: 'question' | 'answer') => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      if (target === 'question') {
        setQuestionImage(dataUrl);
      } else {
        setAnswerImage(dataUrl);
      }
      setGenerationError(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片读取失败');
    } finally {
      event.target.value = '';
    }
  }, []);

  const persistRubric = useCallback(async (rubric: RubricJSONV3) => {
    const normalizedRubric: RubricJSONV3 = {
      ...rubric,
      metadata: {
        ...rubric.metadata,
        examId: activeExamId || rubric.metadata.examId || null,
        examName: resolvedExamName || rubric.metadata.examName || '',
        grade: grade || rubric.metadata.grade,
        subject: subject || rubric.metadata.subject,
        questionType: questionType || rubric.metadata.questionType,
        questionId: rubric.metadata.questionId || normalizedQuestionNo,
      },
      content: {
        ...rubric.content,
        totalScore: parsedTotalScore ?? (rubric.content as { totalScore?: number }).totalScore,
      },
    };

    const resolvedKey = selectedQuestionKey
      || findExistingQuestionKey(normalizedRubric)
      || buildManualQuestionKey(normalizedRubric);

    setRubricConfig(resolvedKey, normalizedRubric);
    await saveRubric(
      JSON.stringify(normalizedRubric, null, 2),
      resolvedKey,
      { lifecycleStatus: 'draft' }
    );
    await loadConfiguredQuestions();

    setSelectedQuestionKey(resolvedKey);
    setGeneratedRubric(normalizedRubric);
    return resolvedKey;
  }, [
    activeExamId,
    buildManualQuestionKey,
    findExistingQuestionKey,
    loadConfiguredQuestions,
    normalizedQuestionNo,
    parsedTotalScore,
    resolvedExamName,
    saveRubric,
    selectedQuestionKey,
    setRubricConfig,
    grade,
    subject,
    questionType,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!normalizedQuestionNo) {
      toast.warning('请先填写题号');
      return;
    }
    if (!parsedTotalScore) {
      toast.warning('请先填写有效总分');
      return;
    }
    if (!questionImage) {
      toast.warning('请先上传试题图片');
      return;
    }

    const normalizedSubject = normalizeSubjectValue(subject);
    const resolvedQuestionType = questionType || getQuestionTypeOptions(normalizedSubject)[0]?.value || '材料题';
    const strategyType = inferStrategyTypeByQuestionType(normalizedSubject, resolvedQuestionType);

    setIsGenerating(true);
    setGenerationError(null);
    setViewState('generating');
    const requestId = generationRequestIdRef.current + 1;
    generationRequestIdRef.current = requestId;

    try {
      const rubric = await generateRubricFromImages(
        questionImage,
        answerImage,
        normalizedQuestionNo,
        {
          subject: normalizedSubject,
          questionType: resolvedQuestionType,
          strategyType,
          examName: resolvedExamName || undefined,
          totalScore: parsedTotalScore,
          customRules,
          taskScope: 'question',
          parentQuestionId: normalizedQuestionNo,
        }
      );

      const normalizedRubric: RubricJSONV3 = {
        ...rubric,
        metadata: {
          ...rubric.metadata,
          examName: resolvedExamName || rubric.metadata.examName || '',
          examId: activeExamId || rubric.metadata.examId || null,
          grade,
          subject: normalizedSubject,
          questionType: resolvedQuestionType,
          questionId: normalizedQuestionNo,
        },
        content: {
          ...rubric.content,
          totalScore: parsedTotalScore,
        },
      };

      if (requestId !== generationRequestIdRef.current) return;
      setGeneratedRubric(normalizedRubric);
      setResultBackTarget('input');
      setViewState('result');
      toast.success('细则已生成，请核对后保存');
    } catch (error) {
      if (requestId !== generationRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : '生成失败，请重试';
      setGenerationError(message);
      setViewState('input');
      toast.error(message);
    } finally {
      if (requestId === generationRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }, [
    activeExamId,
    answerImage,
    normalizedQuestionNo,
    parsedTotalScore,
    questionImage,
    questionType,
    grade,
    resolvedExamName,
    subject,
    customRules,
  ]);

  const openSavedRubric = useCallback((questionKey: string, backTarget: 'welcome' | 'list') => {
    const target = rubricData?.[questionKey];
    if (!target) {
      toast.error('未找到对应评分细则');
      return;
    }

    try {
      const normalized = coerceRubricToV3(target).rubric;
      const resolvedSubject = normalizeSubjectValue(normalized.metadata.subject || defaultSubject);
      const resolvedQuestionType = normalizeQuestionTypeValue(resolvedSubject, normalized.metadata.questionType)
        || getQuestionTypeOptions(resolvedSubject)[0]?.value
        || defaultQuestionType;
      const resolvedTotal = (normalized.content as { totalScore?: number }).totalScore;

      setGeneratedRubric(normalized);
      setSelectedQuestionKey(questionKey);
      setQuestionNo(normalized.metadata.questionId || '');
      setTotalScore(typeof resolvedTotal === 'number' ? String(resolvedTotal) : '');
      setSubject(resolvedSubject);
      setQuestionType(resolvedQuestionType);
      setGrade(normalized.metadata.grade || '初三');
      setExamName(normalized.metadata.examName || '');
      setActiveExamId(normalized.metadata.examId || null);
      setGenerationError(null);
      setResultBackTarget(backTarget);
      setViewState('result');
    } catch (error) {
      console.error('[RubricPanelHeroSimple] Select rubric error:', error);
      toast.error('细则数据格式异常，无法打开');
    }
  }, [defaultQuestionType, defaultSubject, rubricData, setActiveExamId]);

  const handleUseTemplate = useCallback((template: RubricTemplateSeed) => {
    const normalizedSubject = normalizeSubjectValue(template.subject || defaultSubject);
    const resolvedQuestionType = normalizeQuestionTypeValue(normalizedSubject, template.questionType)
      || getQuestionTypeOptions(normalizedSubject)[0]?.value
      || defaultQuestionType;

    setInputBackTarget('list');
    setSubject(normalizedSubject);
    setQuestionType(resolvedQuestionType);
    setSelectedQuestionKey(null);
    setGeneratedRubric(null);
    setGenerationError(null);
    setQuestionNo('');
    setTotalScore('');
    setQuestionImage(null);
    setAnswerImage(null);
    if (template.examId) {
      setActiveExamId(template.examId);
    }
    if (template.examName) {
      setExamName(template.examName);
    }
    setViewState('input');
    toast.success(`已应用模板：${normalizedSubject} · ${resolvedQuestionType}`);
  }, [defaultQuestionType, defaultSubject, setActiveExamId]);

  const handleSelectRubric = useCallback((questionKey: string) => {
    openSavedRubric(questionKey, 'list');
  }, [openSavedRubric]);

  const handleImportRubric = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = coerceRubricToV3(parsed).rubric;
      const normalizedSubject = normalizeSubjectValue(normalized.metadata.subject || defaultSubject);
      const resolvedQuestionType = normalizeQuestionTypeValue(normalizedSubject, normalized.metadata.questionType)
        || getQuestionTypeOptions(normalizedSubject)[0]?.value
        || defaultQuestionType;
      const resolvedTotal = (normalized.content as { totalScore?: number }).totalScore;

      setGeneratedRubric(normalized);
      setSelectedQuestionKey(null);
      setQuestionNo(normalized.metadata.questionId || '');
      setTotalScore(typeof resolvedTotal === 'number' ? String(resolvedTotal) : '');
      setSubject(normalizedSubject);
      setQuestionType(resolvedQuestionType);
      setGrade(normalized.metadata.grade || '初三');
      setExamName(normalized.metadata.examName || '');
      setActiveExamId(normalized.metadata.examId || null);
      setGenerationError(null);
      setResultBackTarget('welcome');
      setViewState('result');
      toast.success('已导入评分细则');
    } catch (error) {
      toast.error('导入失败：仅支持 Rubric v3 JSON');
    } finally {
      event.target.value = '';
    }
  }, [defaultQuestionType, defaultSubject, setActiveExamId]);

  const handleSave = useCallback(async (rubric: RubricJSONV3) => {
    try {
      await persistRubric(rubric);
      toast.success('评分细则已保存备用');
      resetForm();
      setViewState('list');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败，请重试');
    }
  }, [persistRubric, resetForm]);

  const renderSecondaryHeader = useCallback((onBack: () => void) => (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E2E9F5] bg-white/92 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        className="grid h-8 w-8 place-items-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100"
        aria-label="返回"
      >
        <ChevronLeft className="h-4.5 w-4.5" />
      </button>
      <h1 className="text-[16px] font-black tracking-tight text-[#17233A]">生成评分细则</h1>
      <div className="flex items-center gap-1">
        <span className="rounded-full border border-[#F2D9B8] bg-[#FFF7EC] px-2 py-0.5 text-[11px] font-bold text-[#8B5A1F]">
          {quota.isPaid ? 'PRO' : '试用版'}
        </span>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label="打开设置"
          className="h-8 min-h-8 w-8 min-w-8 rounded-full border border-[#E2E9F5] bg-white text-zinc-600"
          onPress={() => setActiveTab(Tab.Settings)}
        >
          <Settings size={15} />
        </Button>
      </div>
    </header>
  ), [quota.isPaid, setActiveTab]);

  if (viewState === 'welcome') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E2E9F5] bg-white/92 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[#E2E9F5] bg-[#F4F8FF] text-[14px] font-black text-primary">
              AI
            </span>
            <h1 className="text-[20px] font-black tracking-tight text-[#17233A]">智能阅卷</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-full border border-[#F2D9B8] bg-[#FFF7EC] px-2 py-0.5 text-[11px] font-bold text-[#8B5A1F]">
              {quota.isPaid ? 'PRO' : '试用版'}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="打开设置"
              className="h-8 min-h-8 w-8 min-w-8 rounded-full border border-[#E2E9F5] bg-white text-zinc-600"
              onPress={() => setActiveTab(Tab.Settings)}
            >
              <Settings size={15} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-1.5 py-2">
          <button
            type="button"
            aria-label="智能创建评分细则"
            onClick={() => openInput('welcome')}
            className="group relative mt-1 overflow-hidden rounded-3xl border border-primary-400/20 bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 p-5 text-left text-white shadow-[0_20px_40px_-5px_rgba(0,111,238,0.34),0_0_24px_rgba(120,40,200,0.24)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.985]"
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl transition-colors duration-300 group-hover:bg-white/30" />
            <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-secondary-300/30 blur-2xl" />
            <div className="relative z-10">
              <div className="mb-4 flex items-start justify-between gap-2">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/25 bg-white/20 backdrop-blur">
                  <WandSparkles size={22} />
                </span>
                <span className="rounded-lg border border-white/25 bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide">
                  AI 驱动
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight">智能创建细则</h3>
              <p className="mt-2 max-w-[90%] text-xs font-medium leading-5 text-white/85">
                上传试题与答案，让 AI 自动分析并生成可编辑评分标准。
              </p>
              <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-sm font-bold text-primary-600 shadow-sm transition-colors group-hover:bg-default-50">
                立即开始
              </div>
            </div>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label="导入细则"
              onClick={() => importInputRef.current?.click()}
              className="group rounded-3xl border border-white/75 bg-white/65 p-3 text-left shadow-[0_14px_30px_-14px_rgba(0,111,238,0.32),0_0_18px_rgba(0,111,238,0.14)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 active:scale-[0.985]"
            >
              <span className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-cyan-100 to-blue-100 text-cyan-600 transition-transform duration-200 group-hover:scale-110">
                <FileUp size={17} />
              </span>
              <p className="text-sm font-bold text-default-800">导入细则</p>
              <p className="mt-1 text-[11px] font-medium text-default-500">支持 JSON 文件继续编辑</p>
            </button>

            <button
              type="button"
              aria-label="进入评分细则列表"
              onClick={() => setViewState('list')}
              className="group rounded-3xl border border-white/75 bg-white/65 p-3 text-left shadow-[0_14px_30px_-14px_rgba(120,40,200,0.32),0_0_18px_rgba(120,40,200,0.16)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 active:scale-[0.985]"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-purple-100 to-pink-100 text-purple-600 transition-transform duration-200 group-hover:scale-110">
                  <BookTemplate size={17} />
                </span>
                <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                  {configuredRubricCountLabel}
                </span>
              </div>
              <p className="text-sm font-bold text-default-800">模板库</p>
              <p className="mt-1 text-[11px] font-medium text-default-500">常用标准合集</p>
            </button>
          </div>

          <Card
            shadow="none"
            className="mt-3 rounded-3xl border border-white/70 bg-white/62 shadow-[0_12px_28px_-16px_rgba(0,111,238,0.2),0_0_16px_rgba(120,40,200,0.1)] backdrop-blur-xl"
          >
            <CardHeader className="flex items-center justify-between gap-2 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-default-400">最近细则</p>
              <Chip size="sm" variant="flat" color="primary">
                {configuredRubricCountLabel}
              </Chip>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              {recentRubrics.length === 0 ? (
                <div className="rounded-large border border-default-200 bg-default-50 p-3 text-center">
                  <p className="text-sm font-semibold text-default-500">暂无评分细则</p>
                  <p className="mt-1 text-[11px] text-default-400">先创建或导入一个细则开始使用</p>
                </div>
              ) : (
                recentRubrics.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`打开细则 ${item.alias || item.id}`}
                    onClick={() => openSavedRubric(item.id, 'welcome')}
                    className="flex w-full items-center justify-between gap-2 rounded-large border border-default-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-default-700">{item.alias || item.id}</p>
                      <p className="mt-0.5 text-[11px] text-default-400">{item.subject || item.id}</p>
                    </div>
                    <Chip size="sm" variant="flat" color="primary">
                      {item.questionNo || '-'}
                    </Chip>
                  </button>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            void handleImportRubric(event);
          }}
        />
      </div>
    );
  }

  if (viewState === 'list') {
    return (
      <RubricListView
        onBack={() => setViewState('welcome')}
        onCreateNew={() => {
          setInputBackTarget('list');
          resetForm();
        }}
        onSelectRubric={handleSelectRubric}
        onUseTemplate={handleUseTemplate}
        initialStatusFilter="all"
        headerMode="simple"
        headerTitle="评分细则列表"
      />
    );
  }

  if (viewState === 'generating') {
    return (
      <div className="flex h-full flex-col">
        {renderSecondaryHeader(() => {
          generationRequestIdRef.current += 1;
          setIsGenerating(false);
          setViewState('input');
        })}
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md border border-primary-100 bg-white/80 shadow-lg">
            <CardHeader className="flex flex-col items-center gap-2 pb-0">
              <Chip color="primary" variant="flat" startContent={<Sparkles size={14} />}>
                AI 生成中
              </Chip>
              <p className="text-base font-semibold text-zinc-700">{GENERATION_MESSAGES[generationStep]}</p>
            </CardHeader>
            <CardBody className="items-center gap-4 pt-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-50 text-primary-600">
                <Loader2 className="animate-spin" size={28} />
              </div>
              <div className="w-full max-w-xs">
                <Progress value={generationProgress} color="primary" size="sm" />
              </div>
              <p className="text-sm text-zinc-500">预计 5-10 秒，请稍候</p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (viewState === 'result' && generatedRubric) {
    return (
      <RubricResultView
        rubric={generatedRubric}
        examName={resolvedExamName}
        subject={subject}
        questionNo={normalizedQuestionNo}
        headerMode="simple"
        headerTitle="生成评分细则"
        onBack={() => {
          setViewState(resultBackTarget);
          setGenerationError(null);
        }}
        onSave={(rubric) => {
          void handleSave(rubric);
        }}
        onRegenerate={() => {
          setInputBackTarget(resultBackTarget === 'list' ? 'list' : 'welcome');
          setViewState('input');
          setGenerationError(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {renderSecondaryHeader(() => setViewState(inputBackTarget))}

      <div className="flex-1 overflow-y-auto px-1.5 py-2 pb-24">
        {generationError ? (
          <Card className="mb-3 border border-danger-200 bg-danger-50/80">
            <CardBody>
              <p className="text-sm font-semibold text-danger-700">{generationError}</p>
            </CardBody>
          </Card>
        ) : null}

        <Card className="border border-default-200 bg-white/85 shadow-sm">
          <CardBody className="space-y-3 !px-2 !pb-2 !pt-2">
          <section className="space-y-1">
            <p className="pl-1 text-[12px] font-bold text-zinc-700">1.上传评分图片</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => questionImageRef.current?.click()}
                className="group h-24 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/40 transition hover:bg-primary-50"
              >
                {questionImage ? (
                  <div className="relative h-full p-1.5">
                    <Image src={questionImage} alt="试题图片" className="h-full w-full rounded-xl object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">已上传</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setQuestionImage(null);
                      }}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white"
                      aria-label="移除试题图片"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-primary-700">
                    <ImagePlus size={16} />
                    <span className="text-[11px] font-bold">上传试题（必填）</span>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => answerImageRef.current?.click()}
                className="group h-24 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/60 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                {answerImage ? (
                  <div className="relative h-full p-1.5">
                    <Image src={answerImage} alt="答案图片" className="h-full w-full rounded-xl object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">已上传</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setAnswerImage(null);
                      }}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white"
                      aria-label="移除答案图片"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-500">
                    <FileImage size={16} />
                    <span className="text-[11px] font-semibold">上传答案（可选）</span>
                  </div>
                )}
              </button>
            </div>

            <input
              ref={questionImageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void handleImageUpload('question')(event);
              }}
            />
            <input
              ref={answerImageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void handleImageUpload('answer')(event);
              }}
            />
          </section>

          <section className="space-y-2">
            <p className="pl-1 text-[12px] font-bold text-zinc-700">2.填写基本信息</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">考试名称（可选）</label>
                <input
                  value={examName}
                  onChange={(event) => handleExamNameChange(event.target.value)}
                  placeholder="例如：2026 春季期中"
                  list="hero-exam-options"
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 placeholder:text-zinc-400 outline-none transition focus:border-primary-300 focus:bg-white"
                />
                <datalist id="hero-exam-options">
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">学段</label>
                <select
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 outline-none transition focus:border-primary-300 focus:bg-white"
                >
                  {GRADE_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">学科</label>
                <select
                  value={subject}
                  onChange={(event) => {
                    const nextSubject = event.target.value;
                    setSubject(nextSubject);
                    const nextType = getQuestionTypeOptions(normalizeSubjectValue(nextSubject))[0]?.value;
                    if (nextType) {
                      setQuestionType(nextType);
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 outline-none transition focus:border-primary-300 focus:bg-white"
                >
                  {subjectOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">题型</label>
                <select
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value)}
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 outline-none transition focus:border-primary-300 focus:bg-white"
                >
                  {questionTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">题号 *</label>
                <input
                  value={questionNo}
                  onChange={(event) => setQuestionNo(event.target.value)}
                  placeholder="例如：13 或 13-1"
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 placeholder:text-zinc-400 outline-none transition focus:border-primary-300 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="mb-1 block pl-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">总分 *</label>
                <input
                  type="number"
                  min={1}
                  value={totalScore}
                  onChange={(event) => setTotalScore(event.target.value)}
                  placeholder="例如：10"
                  className="h-9 w-full rounded-lg border border-default-200 bg-default-100 px-3 text-sm font-medium text-zinc-700 placeholder:text-zinc-400 outline-none transition focus:border-primary-300 focus:bg-white"
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="pl-1 text-[12px] font-bold text-zinc-700">3.添加特殊规则</p>
            <textarea
              ref={specialRulesRef}
              value={specialRulesText}
              onChange={(event) => setSpecialRulesText(event.target.value)}
              rows={2}
              placeholder={'例如：\n错别字每3个扣1分\n未写结论扣1分'}
              className="w-full resize-none overflow-hidden rounded-lg border border-default-200 bg-default-100 px-3 py-1.5 text-sm font-medium leading-5 text-zinc-700 placeholder:text-zinc-400 outline-none transition focus:border-primary-300 focus:bg-white"
            />
            <p className="pl-1 text-[10px] font-medium text-zinc-500">每行一条，AI 生成时会自动纳入规则约束。</p>
          </section>

          <div className="rounded-xl border border-primary-100 bg-primary-50/45 p-2">
            <p className="text-[11px] font-semibold text-primary-700">
              AI 将自动拆分并填充：问题词、得分点、分值、关键词。
            </p>
          </div>
          </CardBody>
        </Card>

        <div className="fixed inset-x-0 z-20 w-full px-1.5" style={{ bottom: 'calc(50px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="rounded-2xl border border-white/70 bg-white/85 p-1.5 shadow-lg backdrop-blur-xl">
            <div className="flex gap-2">
              <Button
                variant="flat"
                color="default"
                className="h-10 flex-1 font-semibold"
                onPress={resetForm}
              >
                清空
              </Button>
              <Button
                color="primary"
                className="h-10 flex-[1.6] font-bold"
                startContent={isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                isDisabled={!hasQuestionImage || !hasBasicInfo || isGenerating}
                onPress={() => {
                  void handleGenerate();
                }}
              >
                {isGenerating ? '生成中...' : '生成细则'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RubricPanelHeroSimple;
