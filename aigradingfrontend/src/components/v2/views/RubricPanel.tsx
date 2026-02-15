import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    Camera,
    ChevronDown,
    ChevronLeft,
    Compass,
    FileCheck2,
    Image as ImageIcon,
    Info,
    Library,
    Loader2,
    RotateCcw,
    Sparkles,
    Trash2,
    Upload,
    Zap
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages } from '@/services/rubric-service';
import { createRubricTemplate } from '@/services/rubric-templates';
import { toast } from '@/components/Toast';
import type { RubricJSONV3, StrategyType } from '@/types/rubric-v3';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import RubricResultView from './RubricResultView';
import RubricListView from './RubricListView';
import type { RubricTemplateSeed } from './RubricListView';
import {
    RUBRIC_STRATEGY_OPTIONS,
    getQuestionTypeOptions,
    getSubjectOptions,
    inferStrategyTypeByQuestionType,
    normalizeQuestionTypeValue,
    normalizeSubjectValue
} from './rubric-config';
import { validateRubricForTemplate } from './rubric-validator';
import { setRubricTemplateLifecycleStatus } from './rubric-template-status';

type ViewState = 'welcome' | 'list' | 'input' | 'generating' | 'result';
type UploadTarget = 'question' | 'answer';
type TaskScope = 'question' | 'subquestion';
type FlowStepKey = 'upload' | 'generate' | 'save';

interface InputFieldErrors {
    questionNo?: string;
    totalScore?: string;
    questionImage?: string;
}

const GENERATING_MESSAGES = [
    '正在识别题干结构...',
    '正在提取采分点与关键词...',
    '正在匹配评分策略与题型...',
    '正在生成可编辑评分细则...'
];

const SUBJECT_OPTIONS = getSubjectOptions();
const GRADE_OPTIONS = ['初一', '初二', '初三', '高一', '高二', '高三'];

const FLOW_STEPS: Array<{
    key: FlowStepKey;
    title: string;
}> = [
    {
        key: 'upload',
        title: '上传评分图片'
    },
    {
        key: 'generate',
        title: 'AI 生成细则'
    },
    {
        key: 'save',
        title: '保存备用'
    }
];

interface SubjectFieldPreset {
    defaultQuestionType?: string;
    preferredStrategies: StrategyType[];
}

const SUBJECT_FIELD_PRESETS: Record<string, SubjectFieldPreset> = {
    历史: {
        defaultQuestionType: '材料解析题',
        preferredStrategies: ['point_accumulation', 'rubric_matrix']
    },
    道法: {
        defaultQuestionType: '材料分析题',
        preferredStrategies: ['point_accumulation', 'rubric_matrix']
    },
    数学: {
        defaultQuestionType: '解答题',
        preferredStrategies: ['sequential_logic', 'point_accumulation']
    }
};

function resolveDefaultQuestionTypeForSubject(subject: string, fallback: string): string {
    const normalizedSubject = normalizeSubjectValue(subject);
    const options = getQuestionTypeOptions(normalizedSubject);
    const presetType = SUBJECT_FIELD_PRESETS[normalizedSubject]?.defaultQuestionType;
    if (presetType && options.some((item) => item.value === presetType)) {
        return presetType;
    }
    return options[0]?.value || fallback;
}

function detectStrategyByKeywords(text: string): StrategyType | null {
    const normalized = text.toLowerCase();
    const rubricRegex = /(分档|等级|一类|二类|三类|史论结合|观点论证|作文|论述|评价|主题命名|书面表达|辨析)/;
    if (rubricRegex.test(normalized)) return 'rubric_matrix';

    const sequentialRegex = /(步骤|过程|推导|实验|作图|计算|证明|流程|操作|解答)/;
    if (sequentialRegex.test(normalized)) return 'sequential_logic';

    const pointRegex = /(任答|任意|列举|概括|说明|影响|简答|选择|填空|阅读|材料分析|要点)/;
    if (pointRegex.test(normalized)) return 'point_accumulation';

    return null;
}

function parseTaskIdentifier(rawQuestionId?: string | null): {
    taskScope: TaskScope;
    questionNo: string;
    subQuestionNo: string;
} {
    const normalized = (rawQuestionId || '').trim().replace(/[—－]/g, '-');
    if (!normalized) {
        return { taskScope: 'question', questionNo: '', subQuestionNo: '' };
    }

    const separatorIndex = normalized.indexOf('-');
    if (separatorIndex > 0 && separatorIndex < normalized.length - 1) {
        return {
            taskScope: 'subquestion',
            questionNo: normalized.slice(0, separatorIndex).trim(),
            subQuestionNo: normalized.slice(separatorIndex + 1).trim()
        };
    }

    return { taskScope: 'question', questionNo: normalized, subQuestionNo: '' };
}

function parseInlineTaskInput(rawValue?: string): { questionNo: string; subQuestionNo: string } | null {
    const normalized = (rawValue || '').trim().replace(/[—－]/g, '-');
    if (!normalized) return null;
    const match = normalized.match(/^([^-]+)-([^-]+)$/);
    if (!match) return null;
    return {
        questionNo: match[1].trim(),
        subQuestionNo: match[2].trim()
    };
}

export default function RubricPanel() {
    const {
        exams,
        rubricLibrary,
        rubricData,
        activeExamId,
        setActiveExamId,
        setRubricConfig,
        saveRubric,
        loadConfiguredQuestions
    } = useAppStore();

    const defaultSubject = SUBJECT_OPTIONS[0]?.value || '历史';
    const defaultQuestionType = resolveDefaultQuestionTypeForSubject(defaultSubject, '材料题');

    const [viewState, setViewState] = useState<ViewState>('welcome');
    const [inputBackTarget, setInputBackTarget] = useState<'welcome' | 'list'>('welcome');
    const [generatedRubric, setGeneratedRubric] = useState<RubricJSONV3 | null>(null);
    const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const uploadSectionRef = useRef<HTMLElement>(null);
    const basicExamSectionRef = useRef<HTMLElement>(null);
    const basicDetailSectionRef = useRef<HTMLElement>(null);
    const rulesSectionRef = useRef<HTMLElement>(null);
    const questionImageUploadRef = useRef<HTMLLabelElement>(null);
    const examNameInputRef = useRef<HTMLInputElement>(null);
    const questionNoInputRef = useRef<HTMLInputElement>(null);
    const subQuestionNoInputRef = useRef<HTMLInputElement>(null);
    const totalScoreInputRef = useRef<HTMLInputElement>(null);
    const customRulesTextareaRef = useRef<HTMLTextAreaElement>(null);

    const [examName, setExamName] = useState('');
    const [taskScope, setTaskScope] = useState<TaskScope>('question');
    const [questionNo, setQuestionNo] = useState('');
    const [subQuestionNo, setSubQuestionNo] = useState('');
    const [totalScore, setTotalScore] = useState('');
    const [subject, setSubject] = useState(defaultSubject);
    const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
    const [questionType, setQuestionType] = useState(defaultQuestionType);
    const [strategyType, setStrategyType] = useState<StrategyType>(
        inferStrategyTypeByQuestionType(defaultSubject, defaultQuestionType)
    );
    const [manualStrategyOverride, setManualStrategyOverride] = useState(false);

    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);
    const [activeUploadTarget, setActiveUploadTarget] = useState<UploadTarget | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<InputFieldErrors>({});

    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationStep, setGenerationStep] = useState(0);
    const [customRulesText, setCustomRulesText] = useState('');
    const [showAdvancedRules, setShowAdvancedRules] = useState(false);

    const selectedExam = useMemo(
        () => exams.find((e) => e.id === activeExamId),
        [exams, activeExamId]
    );
    const resolvedExamName = useMemo(
        () => (examName || selectedExam?.name || '').trim(),
        [examName, selectedExam?.name]
    );
    const normalizedSubject = useMemo(
        () => normalizeSubjectValue(subject),
        [subject]
    );
    const subjectPreset = useMemo(
        () => SUBJECT_FIELD_PRESETS[normalizedSubject] || null,
        [normalizedSubject]
    );

    const questionTypeOptions = useMemo(
        () => getQuestionTypeOptions(subject),
        [subject]
    );
    const subjectStrategyOptions = useMemo(() => {
        const supported = new Set(questionTypeOptions.map((item) => item.strategyType));
        const preferred = subjectPreset?.preferredStrategies || [];
        const ordered = [...preferred, ...Array.from(supported)];
        const deduped = ordered.filter((item, index) => ordered.indexOf(item) === index);
        const mapped = deduped
            .map((strategy) => RUBRIC_STRATEGY_OPTIONS.find((item) => item.value === strategy))
            .filter((item): item is (typeof RUBRIC_STRATEGY_OPTIONS)[number] => Boolean(item));
        return mapped.length > 0 ? mapped : RUBRIC_STRATEGY_OPTIONS;
    }, [questionTypeOptions, subjectPreset]);

    const generatingProgress = ((generationStep + 1) / GENERATING_MESSAGES.length) * 100;
    const customRules = useMemo(
        () => customRulesText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        [customRulesText]
    );
    const normalizedQuestionNo = questionNo.trim();
    const normalizedSubQuestionNo = subQuestionNo.trim();
    const resolvedQuestionId = useMemo(() => {
        if (taskScope === 'subquestion') {
            if (!normalizedQuestionNo || !normalizedSubQuestionNo) return '';
            return `${normalizedQuestionNo}-${normalizedSubQuestionNo}`;
        }
        return normalizedQuestionNo;
    }, [normalizedQuestionNo, normalizedSubQuestionNo, taskScope]);
    const strategyRecommendation = useMemo(() => {
        const reasons: string[] = [];
        const typedInference = inferStrategyTypeByQuestionType(subject, questionType);
        let recommended = typedInference;
        reasons.push(`题型映射：${questionType} -> ${typedInference}`);

        const keywordSource = [questionType, customRulesText].filter(Boolean).join('\n');
        const keywordInference = detectStrategyByKeywords(keywordSource);
        if (keywordInference && keywordInference !== typedInference) {
            recommended = keywordInference;
            reasons.push(`关键词命中：${keywordInference}`);
        }

        reasons.push(taskScope === 'subquestion' ? '任务单元：小问模式' : '任务单元：整题模式');

        return {
            strategyType: recommended,
            reasons
        };
    }, [subject, questionType, customRulesText, taskScope, resolvedQuestionId]);
    const recommendedStrategyLabel = useMemo(
        () => RUBRIC_STRATEGY_OPTIONS.find((item) => item.value === strategyRecommendation.strategyType)?.label || strategyRecommendation.strategyType,
        [strategyRecommendation.strategyType]
    );
    const strategyReasonText = useMemo(
        () => strategyRecommendation.reasons.join('；'),
        [strategyRecommendation.reasons]
    );
    const filteredQuestionTypeOptions = useMemo(() => {
        const exact = questionTypeOptions.filter((item) => item.strategyType === strategyType);
        return exact.length > 0 ? exact : questionTypeOptions;
    }, [questionTypeOptions, strategyType]);

    useEffect(() => {
        if (selectedExam?.name) {
            setExamName(selectedExam.name);
        }
    }, [selectedExam?.name]);

    useEffect(() => {
        if (!manualStrategyOverride) {
            setStrategyType(strategyRecommendation.strategyType);
        }
    }, [manualStrategyOverride, strategyRecommendation.strategyType]);

    useEffect(() => {
        const supported = subjectStrategyOptions.map((item) => item.value);
        if (supported.length === 0) return;
        if (!supported.includes(strategyType)) {
            const inferred = inferStrategyTypeByQuestionType(subject, questionType, supported[0]);
            const fallback = supported.includes(inferred) ? inferred : supported[0];
            setManualStrategyOverride(false);
            setStrategyType(fallback);
        }
    }, [questionType, strategyType, subject, subjectStrategyOptions]);

    useEffect(() => {
        if (filteredQuestionTypeOptions.length === 0) return;
        if (!filteredQuestionTypeOptions.some((item) => item.value === questionType)) {
            setQuestionType(filteredQuestionTypeOptions[0].value);
        }
    }, [filteredQuestionTypeOptions, questionType]);

    useEffect(() => {
        if (viewState !== 'generating') {
            setGenerationStep(0);
            return;
        }
        const timer = setInterval(() => {
            setGenerationStep((prev) => (prev + 1) % GENERATING_MESSAGES.length);
        }, 1400);
        return () => clearInterval(timer);
    }, [viewState]);

    const resetInputState = useCallback(() => {
        setTaskScope('question');
        setQuestionNo('');
        setSubQuestionNo('');
        setTotalScore('');
        setQuestionImage(null);
        setAnswerImage(null);
        setCustomRulesText('');
        setShowAdvancedRules(false);
        setGenerationError(null);
        setFieldErrors({});
        setActiveUploadTarget(null);
        setManualStrategyOverride(false);
    }, []);

    const appendCustomRule = useCallback((rule: string) => {
        setCustomRulesText((prev) => {
            const current = prev
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean);
            if (current.includes(rule)) return prev;
            return current.length > 0 ? `${current.join('\n')}\n${rule}` : rule;
        });
    }, []);

    const readBlobAsDataUrl = useCallback((blob: Blob): Promise<string> => {
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
            reader.readAsDataURL(blob);
        });
    }, []);

    const loadImageElement = useCallback((src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图片解析失败'));
            img.src = src;
        });
    }, []);

    const compressImageDataUrl = useCallback(async (dataUrl: string): Promise<string> => {
        const image = await loadImageElement(dataUrl);
        const maxSize = 1920;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('浏览器不支持图片压缩');
        }

        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        return canvas.toDataURL('image/jpeg', 0.86);
    }, [loadImageElement]);

    const applyImageToTarget = useCallback(async (
        target: UploadTarget,
        blob: Blob,
        source: 'upload' | 'paste' | 'drop'
    ) => {
        try {
            const rawDataUrl = await readBlobAsDataUrl(blob);
            const compressedDataUrl = await compressImageDataUrl(rawDataUrl);

            if (target === 'question') {
                setQuestionImage(compressedDataUrl);
                setFieldErrors((prev) => ({ ...prev, questionImage: undefined }));
            } else {
                setAnswerImage(compressedDataUrl);
            }

            setGenerationError(null);
            toast.success(source === 'paste' ? '已粘贴图片' : '图片已上传');
        } catch (error) {
            const message = error instanceof Error ? error.message : '处理图片失败';
            toast.error(message);
        }
    }, [compressImageDataUrl, readBlobAsDataUrl]);

    const findExistingQuestionKey = useCallback((rubric: RubricJSONV3): string | null => {
        const targetQuestionId = (rubric.metadata.questionId || '').trim();
        const targetSubject = normalizeSubjectValue(rubric.metadata.subject || '');
        const targetExam = rubric.metadata.examId || null;

        if (!targetQuestionId) return null;

        for (const item of rubricLibrary || []) {
            const existing = rubricData?.[item.id];
            if (!existing) continue;

            try {
                const normalized = coerceRubricToV3(existing).rubric;
                const matchesQuestion = (normalized.metadata.questionId || '').trim() === targetQuestionId;
                const matchesSubject = !targetSubject
                    || normalizeSubjectValue(normalized.metadata.subject || '') === targetSubject;
                const matchesExam = (normalized.metadata.examId || null) === targetExam;

                if (matchesQuestion && matchesSubject && matchesExam) {
                    return item.id;
                }
            } catch {
                continue;
            }
        }

        return null;
    }, [rubricData, rubricLibrary]);

    const buildManualQuestionKey = useCallback((rubric: RubricJSONV3): string => {
        const safeQuestionNo = (rubric.metadata.questionId || questionNo || 'unknown').trim() || 'unknown';
        const safeSubject = (rubric.metadata.subject || subject || 'unknown').trim() || 'unknown';
        const safeExam = (rubric.metadata.examId || activeExamId || 'noexam').trim() || 'noexam';

        return `manual:${safeExam}:${safeSubject}:${safeQuestionNo}`;
    }, [activeExamId, questionNo, subject]);

    const applyTaskIdentifier = useCallback((rawQuestionId?: string | null) => {
        const parsed = parseTaskIdentifier(rawQuestionId);
        setTaskScope(parsed.taskScope);
        setQuestionNo(parsed.questionNo);
        setSubQuestionNo(parsed.subQuestionNo);
        setFieldErrors((prev) => ({
            ...prev,
            questionNo: undefined,
            subQuestionNo: undefined
        }));
    }, []);

    const handleQuestionNoInput = useCallback((value: string) => {
        const inline = parseInlineTaskInput(value);
        if (inline) {
            setTaskScope('subquestion');
            setQuestionNo(inline.questionNo);
            setSubQuestionNo(inline.subQuestionNo);
            setFieldErrors((prev) => ({
                ...prev,
                questionNo: undefined,
                subQuestionNo: undefined
            }));
            return;
        }

        setQuestionNo(value.trim());
        setFieldErrors((prev) => ({ ...prev, questionNo: undefined }));
    }, []);

    const handleSubQuestionNoInput = useCallback((value: string) => {
        const inline = parseInlineTaskInput(value);
        if (inline) {
            setTaskScope('subquestion');
            setQuestionNo(inline.questionNo);
            setSubQuestionNo(inline.subQuestionNo);
            setFieldErrors((prev) => ({
                ...prev,
                questionNo: undefined,
                subQuestionNo: undefined
            }));
            return;
        }

        setSubQuestionNo(value.trim());
        setFieldErrors((prev) => ({ ...prev, subQuestionNo: undefined }));
    }, []);

    const openInput = useCallback((backTarget: 'welcome' | 'list') => {
        setSelectedQuestionKey(null);
        setGeneratedRubric(null);
        setInputBackTarget(backTarget);
        setViewState('input');
        resetInputState();
    }, [resetInputState]);

    const handleCreateNew = useCallback(() => {
        openInput('list');
    }, [openInput]);

    const handleCreateFromGuide = useCallback(() => {
        openInput('welcome');
    }, [openInput]);

    const handleOpenTemplateList = useCallback(() => {
        setViewState('list');
    }, []);

    const handleBackFromTemplateList = useCallback(() => {
        setViewState('welcome');
    }, []);

    const handleImportRubricFromGuide = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = JSON.parse((e.target?.result as string) || '{}');
                const normalized = coerceRubricToV3(raw).rubric;
                setGeneratedRubric(normalized);
                setSelectedQuestionKey(null);
                applyTaskIdentifier(normalized.metadata.questionId || '');
                const importedTotal = (normalized.content as { totalScore?: number }).totalScore;
                setTotalScore(typeof importedTotal === 'number' ? String(importedTotal) : '');
                const normalizedSubject = normalizeSubjectValue(normalized.metadata.subject || defaultSubject);
                setSubject(normalizedSubject);
                setGrade(normalized.metadata.grade || GRADE_OPTIONS[2]);
                const nextType = normalizeQuestionTypeValue(
                    normalizedSubject,
                    normalized.metadata.questionType
                )
                    || getQuestionTypeOptions(normalizedSubject)[0]?.value
                    || defaultQuestionType;
                setQuestionType(nextType);
                setStrategyType(
                    normalized.strategyType
                    || inferStrategyTypeByQuestionType(normalizedSubject, nextType)
                );
                setManualStrategyOverride(true);
                setActiveExamId(normalized.metadata.examId || null);
                setExamName(normalized.metadata.examName || '');
                setInputBackTarget('welcome');
                setViewState('result');
                toast.success('已导入评分细则，可继续编辑后保存');
            } catch (error) {
                console.error('[RubricPanel] Import rubric error:', error);
                toast.error('导入失败：仅支持 Rubric v3 JSON');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [applyTaskIdentifier, defaultQuestionType, defaultSubject, setActiveExamId]);

    const handleUseTemplate = useCallback((template: RubricTemplateSeed) => {
        setSelectedQuestionKey(null);
        setGeneratedRubric(null);
        setGenerationError(null);
        setFieldErrors({});
        setTaskScope('question');
        setQuestionNo('');
        setSubQuestionNo('');
        setTotalScore('');
        setQuestionImage(null);
        setAnswerImage(null);
        setCustomRulesText('');
        setShowAdvancedRules(false);
        const normalizedSubject = normalizeSubjectValue(template.subject);
        const normalizedType = normalizeQuestionTypeValue(normalizedSubject, template.questionType)
            || getQuestionTypeOptions(normalizedSubject)[0]?.value
            || defaultQuestionType;
        setSubject(normalizedSubject);
        setQuestionType(normalizedType);
        setStrategyType(template.strategyType || inferStrategyTypeByQuestionType(normalizedSubject, normalizedType));
        setManualStrategyOverride(Boolean(template.strategyType));
        setActiveUploadTarget(null);
        if (template.examId) {
            setActiveExamId(template.examId);
        }
        setInputBackTarget('list');
        setViewState('input');
        toast.success(`已应用模板：${normalizedSubject} · ${normalizedType}`);
    }, [defaultQuestionType, setActiveExamId]);

    const handleSelectRubric = useCallback((questionKey: string) => {
        const target = rubricData?.[questionKey];
        if (!target) {
            toast.error('未找到对应评分细则');
            return;
        }

        try {
            const normalized = coerceRubricToV3(target).rubric;
            setGeneratedRubric(normalized);
            setSelectedQuestionKey(questionKey);
            applyTaskIdentifier(normalized.metadata.questionId || '');
            const selectedTotal = (normalized.content as { totalScore?: number }).totalScore;
            setTotalScore(typeof selectedTotal === 'number' ? String(selectedTotal) : '');
            const normalizedSubject = normalizeSubjectValue(normalized.metadata.subject || defaultSubject);
            setSubject(normalizedSubject);
            setGrade(normalized.metadata.grade || GRADE_OPTIONS[2]);
            const nextType = normalizeQuestionTypeValue(
                normalizedSubject,
                normalized.metadata.questionType
            ) || getQuestionTypeOptions(normalizedSubject)[0]?.value || defaultQuestionType;
            setQuestionType(nextType);
            setStrategyType(normalized.strategyType || inferStrategyTypeByQuestionType(normalizedSubject, nextType));
            setManualStrategyOverride(Boolean(normalized.strategyType));
            setActiveExamId(normalized.metadata.examId || null);
            setExamName(normalized.metadata.examName || '');
            setGenerationError(null);
            setViewState('result');
        } catch (error) {
            console.error('[RubricPanel] Select rubric error:', error);
            toast.error('细则数据格式异常，无法打开');
        }
    }, [applyTaskIdentifier, defaultQuestionType, defaultSubject, rubricData, setActiveExamId]);

    const handleBackToList = useCallback(() => {
        setViewState(inputBackTarget);
    }, [inputBackTarget]);

    const handleExamNameChange = useCallback((value: string) => {
        setExamName(value);
        setFieldErrors((prev) => ({ ...prev, examName: undefined }));
        const matchedExam = exams.find((exam) => exam.name.trim() === value.trim());
        setActiveExamId(matchedExam?.id || null);
    }, [exams, setActiveExamId]);

    const handleImageUpload = useCallback((target: UploadTarget) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setActiveUploadTarget(target);
        void applyImageToTarget(target, file, 'upload');
        e.target.value = '';
    }, [applyImageToTarget]);

    const handleDropUpload = useCallback((target: UploadTarget) => (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        setActiveUploadTarget(target);
        void applyImageToTarget(target, file, 'drop');
    }, [applyImageToTarget]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    }, []);

    useEffect(() => {
        if (viewState !== 'input') return;

        const handlePaste = (event: ClipboardEvent) => {
            if (!activeUploadTarget) return;
            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find((item) => item.type.startsWith('image/'));
            if (!imageItem) return;

            const file = imageItem.getAsFile();
            if (!file) return;

            event.preventDefault();
            void applyImageToTarget(activeUploadTarget, file, 'paste');
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [activeUploadTarget, applyImageToTarget, viewState]);

    const parseTotalScoreValue = useCallback(() => {
        const parsed = Number(totalScore);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return Math.round(parsed);
    }, [totalScore]);

    const validateInputBeforeGenerate = useCallback(() => {
        const errors: InputFieldErrors = {};
        if (!normalizedQuestionNo) {
            errors.questionNo = '请输入题号';
        }
        if (parseTotalScoreValue() === null) {
            errors.totalScore = '请输入有效总分';
        }
        if (!questionImage) {
            errors.questionImage = '请上传试题图片';
        }
        setFieldErrors(errors);
        return errors;
    }, [normalizedQuestionNo, parseTotalScoreValue, questionImage]);

    const handleGenerate = useCallback(async () => {
        const errors = validateInputBeforeGenerate();
        if (Object.keys(errors).length > 0) {
            const firstError = errors.questionNo || errors.totalScore || errors.questionImage || '请补全信息';
            toast.error(firstError);
            return;
        }

        const resolvedTotalScore = parseTotalScoreValue();
        if (!resolvedTotalScore) {
            toast.error('请输入有效总分');
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);

        try {
            const context = {
                subject,
                grade,
                questionType,
                strategyType,
                examName: resolvedExamName || undefined,
                totalScore: resolvedTotalScore,
                customRules,
                taskScope,
                parentQuestionId: normalizedQuestionNo || undefined,
                subQuestionId: taskScope === 'subquestion' ? normalizedSubQuestionNo || undefined : undefined
            };

            const rubric = await generateRubricFromImages(
                questionImage,
                answerImage,
                resolvedQuestionId || normalizedQuestionNo || 'unknown',
                context
            );

            const normalizedRubric: RubricJSONV3 = {
                ...rubric,
                metadata: {
                    ...rubric.metadata,
                    examName: resolvedExamName || rubric.metadata.examName || '',
                    examId: activeExamId || rubric.metadata.examId || null,
                    subject: subject || rubric.metadata.subject,
                    grade: grade || rubric.metadata.grade,
                    questionType: questionType || rubric.metadata.questionType,
                    questionId: resolvedQuestionId || rubric.metadata.questionId
                },
                content: {
                    ...rubric.content,
                    totalScore: resolvedTotalScore
                },
                strategyType: rubric.strategyType || strategyType
            };

            setGeneratedRubric(normalizedRubric);
            setViewState('result');
        } catch (error) {
            console.error('[RubricPanel] AI generation failed:', error);
            const message = error instanceof Error ? error.message : '服务不可用';
            setGenerationError(message);
            if (message.includes('灰度能力')) {
                toast.error('当前账号未开通个性化规则灰度能力');
            } else {
                toast.error(`生成失败: ${message}`);
            }
        } finally {
            setIsGenerating(false);
        }
    }, [
        activeExamId,
        answerImage,
        grade,
        normalizedQuestionNo,
        normalizedSubQuestionNo,
        parseTotalScoreValue,
        questionImage,
        questionType,
        resolvedQuestionId,
        resolvedExamName,
        strategyType,
        subject,
        taskScope,
        customRules,
        validateInputBeforeGenerate
    ]);

    const normalizeRubricForPersistence = useCallback((rubric: RubricJSONV3): RubricJSONV3 => {
        const resolvedTotalScore = parseTotalScoreValue();
        return {
            ...rubric,
            metadata: {
                ...rubric.metadata,
                examId: activeExamId || rubric.metadata.examId || null,
                examName: resolvedExamName || rubric.metadata.examName || '',
                subject: subject || rubric.metadata.subject,
                grade: grade || rubric.metadata.grade,
                questionType: questionType || rubric.metadata.questionType,
                questionId: rubric.metadata.questionId || resolvedQuestionId
            },
            content: {
                ...rubric.content,
                totalScore: resolvedTotalScore ?? (rubric.content as { totalScore?: number }).totalScore
            }
        };
    }, [activeExamId, grade, parseTotalScoreValue, questionType, resolvedExamName, resolvedQuestionId, subject]);

    const persistRubric = useCallback(async (
        rubric: RubricJSONV3,
        options?: { lifecycleStatus?: 'draft' | 'published' }
    ) => {
        const normalizedRubric = normalizeRubricForPersistence(rubric);
        const resolvedKey = selectedQuestionKey
            || findExistingQuestionKey(normalizedRubric)
            || buildManualQuestionKey(normalizedRubric);

        setRubricConfig(resolvedKey, normalizedRubric);
        await saveRubric(
            JSON.stringify(normalizedRubric, null, 2),
            resolvedKey,
            { lifecycleStatus: options?.lifecycleStatus || 'draft' }
        );
        await loadConfiguredQuestions();

        setSelectedQuestionKey(resolvedKey);
        setGeneratedRubric(normalizedRubric);
        return { normalizedRubric, resolvedKey };
    }, [
        buildManualQuestionKey,
        findExistingQuestionKey,
        loadConfiguredQuestions,
        normalizeRubricForPersistence,
        saveRubric,
        selectedQuestionKey,
        setRubricConfig
    ]);

    const handleSaveRubric = useCallback(async (rubric: RubricJSONV3) => {
        try {
            const { resolvedKey } = await persistRubric(rubric, { lifecycleStatus: 'draft' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'draft');
            toast.success('评分细则已保存');

            setViewState('list');
            resetInputState();
        } catch (error) {
            console.error('[RubricPanel] Save rubric error:', error);
            toast.error('保存失败，请重试');
        }
    }, [
        persistRubric,
        resetInputState
    ]);

    const handleSaveTemplate = useCallback(async (rubric: RubricJSONV3) => {
        const templateValidation = validateRubricForTemplate(rubric);
        if (templateValidation.errors.length > 0) {
            toast.error(templateValidation.errors[0] || '模板校验未通过');
            return;
        }

        try {
            const { normalizedRubric: savedRubric, resolvedKey } = await persistRubric(rubric, { lifecycleStatus: 'draft' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'draft');
            await createRubricTemplate(savedRubric, 'user', {
                questionKey: resolvedKey,
                lifecycleStatus: 'published'
            });
            await persistRubric(savedRubric, { lifecycleStatus: 'published' });
            setRubricTemplateLifecycleStatus(resolvedKey, 'published');
            toast.success('模板已保存到模板库');
            setViewState('list');
            resetInputState();
        } catch (error) {
            console.error('[RubricPanel] Save template error:', error);
            const message = error instanceof Error ? error.message : '模板保存失败';
            toast.error(message);
            throw error;
        }
    }, [persistRubric, resetInputState]);

    const handleRegenerate = useCallback(() => {
        setViewState('input');
        setGenerationError(null);
    }, []);

    const hasQuestionNo = normalizedQuestionNo.length > 0;
    const hasValidTotalScore = parseTotalScoreValue() !== null;
    const hasQuestionImage = Boolean(questionImage);
    const currentFlowStep: FlowStepKey = viewState === 'result'
        ? 'save'
        : viewState === 'generating'
            ? 'generate'
            : hasQuestionImage
                ? 'generate'
                : 'upload';
    const canGenerate = hasQuestionNo && hasValidTotalScore && hasQuestionImage && !isGenerating;
    const hasDraftContent = useMemo(() => {
        return Boolean(
            resolvedExamName
            || normalizedQuestionNo
            || totalScore.trim()
            || questionImage
            || answerImage
        );
    }, [
        answerImage,
        normalizedQuestionNo,
        questionImage,
        resolvedExamName,
        totalScore
    ]);
    const showResetAsPrimaryCta = hasDraftContent && !canGenerate && !isGenerating;

    const handleResetForm = useCallback(() => {
        if (!hasDraftContent) {
            toast.info('当前没有可清空的内容');
            return;
        }

        const confirmed = window.confirm('确认清空当前已填写内容并重新开始吗？');
        if (!confirmed) return;

        resetInputState();
        toast.success('表单已清空');
    }, [hasDraftContent, resetInputState]);

    if (viewState === 'welcome') {
        return (
            <div className="flex h-full flex-col bg-gradient-to-b from-[#EEF3F6] via-[#F4F8FB] to-[#F8FBFE]">
                <div className="border-b border-[#E7ECF2] px-4 py-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE5F2] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#5D6F8D]">
                        <Compass className="h-3.5 w-3.5 text-[#3E59C9]" />
                        Rubric Workspace
                    </div>
                    <h2 className="mt-2 text-[15px] font-black leading-tight text-[#101D35]">评分细则工作台</h2>
                    <p className="mt-1 text-[11px] font-semibold text-[#7A879B]">创建、导入或复用模板，先确认结构后进入生成流程</p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-5">
                    <button
                        type="button"
                        onClick={handleCreateFromGuide}
                        className="group relative flex w-full items-start gap-3 overflow-hidden rounded-[16px] border border-[#D9E3F2] bg-white p-4 text-left shadow-[0_10px_22px_rgba(37,59,101,0.09)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(37,59,101,0.15)]"
                    >
                        <div className="absolute right-0 top-0 h-14 w-14 rounded-bl-[24px] bg-[#EDF2FF]" />
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3E59C9] to-[#2753E5] text-white">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#101D35]">创建评分细则</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#6D7A90]">上传题目与答案图片，AI 自动生成可编辑细则</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="group flex w-full items-start gap-3 rounded-[16px] border border-[#E3E9F1] bg-white p-4 text-left shadow-[0_6px_18px_rgba(37,59,101,0.07)] transition-all hover:border-[#CDD8E7]"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#4C617E]">
                            <Upload className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#101D35]">导入已有细则</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#6D7A90]">导入 Rubric v3 JSON，直接进入编辑与保存</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenTemplateList}
                        className="group flex w-full items-start gap-3 rounded-[16px] border border-[#E3E9F1] bg-white p-4 text-left shadow-[0_6px_18px_rgba(37,59,101,0.07)] transition-all hover:border-[#CDD8E7]"
                    >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#3E59C9]">
                            <Library className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[14px] font-black text-[#101D35]">进入模板库</h3>
                            <p className="mt-1 text-[11px] font-semibold text-[#6D7A90]">查看系统模板与已保存模板，按学科快速复用</p>
                        </div>
                    </button>

                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportRubricFromGuide}
                        className="hidden"
                    />
                </div>
            </div>
        );
    }

    if (viewState === 'list') {
        return (
            <RubricListView
                onBack={handleBackFromTemplateList}
                onCreateNew={handleCreateNew}
                onSelectRubric={handleSelectRubric}
                onUseTemplate={handleUseTemplate}
            />
        );
    }

    if (viewState === 'generating') {
        return (
            <div className="flex h-full flex-col bg-gradient-to-b from-[#EEF3F7] via-[#F8FAFD] to-[#FFFFFF]">
                <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E6ECF3] bg-white/95 px-4 backdrop-blur">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3E59C9] to-[#2149D8] shadow-[0_8px_16px_rgba(62,89,201,0.35)]">
                            <Zap className="h-3.5 w-3.5 animate-pulse text-white" />
                        </div>
                        <h1 className="text-sm font-black text-[#101D35]">AI 正在生成评分细则</h1>
                    </div>
                    <span className="text-[10px] font-bold text-[#4A67D5]">预计 5-10 秒</span>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
                    <div className="relative h-20 w-20">
                        <div className="absolute inset-0 rounded-full border-4 border-[#DDE6F7]" />
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#3E59C9] border-t-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="h-8 w-8 text-[#3E59C9]" />
                        </div>
                    </div>

                    <div className="max-w-[240px] text-center">
                        <p className="text-sm font-bold text-[#1B2A47]">{GENERATING_MESSAGES[generationStep]}</p>
                        <p className="mt-1 text-xs font-semibold text-[#7A879B]">请保持页面稳定，避免频繁切换标签</p>
                    </div>

                    <div className="w-full max-w-[220px]">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#DCE7FD]">
                            <div
                                className="h-full bg-gradient-to-r from-[#3E59C9] via-[#5574E6] to-[#2D52DC] transition-all duration-500"
                                style={{ width: `${generatingProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (viewState === 'result' && generatedRubric) {
        return (
            <RubricResultView
                rubric={generatedRubric}
                examName={examName || selectedExam?.name || ''}
                subject={subject}
                questionNo={resolvedQuestionId || questionNo}
                onSave={handleSaveRubric}
                onRegenerate={handleRegenerate}
                onSaveTemplate={handleSaveTemplate}
                defaultDensity="compact"
            />
        );
    }

    return (
        <div className="flex h-full flex-col bg-gradient-to-b from-[#EDF3F7] via-[#F5F9FC] to-[#FAFCFF]">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-5">
                {generationError && (
                    <div className="flex items-start gap-2 rounded-[12px] border border-red-200 bg-red-50/95 px-3 py-2.5 shadow-[0_4px_10px_rgba(220,38,38,0.08)]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-red-700">{generationError}</p>
                        </div>
                    </div>
                )}

                <section className="order-0">
                    <div className="space-y-3 rounded-[16px] border border-[#DCE5F5] bg-white/95 p-3.5 shadow-[0_8px_20px_rgba(31,52,88,0.06)]">
                        <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black text-[#1B2A47]">细则创建流程</p>
                            <span className="text-[10px] font-semibold text-[#5E6F8E]">
                                当前：{FLOW_STEPS.find((item) => item.key === currentFlowStep)?.title}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {FLOW_STEPS.map((item, index) => {
                                const isCurrent = item.key === currentFlowStep;
                                const isCompleted = item.key === 'upload'
                                    ? hasQuestionImage
                                    : item.key === 'generate'
                                        ? hasQuestionNo && hasValidTotalScore
                                        : viewState === 'result';

                                return (
                                    <div
                                        key={item.key}
                                        className={`rounded-xl border px-2.5 py-2 text-left transition-colors ${isCurrent
                                            ? 'border-[#9BB1EA] bg-[#EDF3FF]'
                                            : isCompleted
                                                ? 'border-[#BFDAFF] bg-[#F3F8FF]'
                                                : 'border-[#E2E8F3] bg-[#F8FAFD]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[10px] font-black text-[#2C4C92]">步骤 {index + 1}</span>
                                            <span className={`text-[9px] font-bold ${isCompleted ? 'text-emerald-600' : 'text-[#7D8CA5]'}`}>
                                                {isCompleted ? '已完成' : '待完成'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-[10px] font-bold text-[#1B2A47]">{item.title}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section ref={basicExamSectionRef} className="order-2">
                    <div className="space-y-3 rounded-[16px] border border-[#E1E8F2] bg-white p-3.5 shadow-[0_8px_20px_rgba(31,52,88,0.06)]">
                        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
                            <button
                                onClick={handleBackToList}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DFE6F1] bg-[#F7FAFF] text-[#4A617D] transition-colors hover:bg-white"
                                aria-label="返回列表"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <div className="inline-flex w-fit items-center gap-1 rounded-md bg-[#ECF2FF] px-2 py-0.5 text-[#3E59C9]">
                                <Info className="h-3 w-3" />
                                <h2 className="text-[11px] font-extrabold">步骤 2/3 · 基础字段</h2>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-extrabold uppercase text-[#8A98AE]">考试名称（可选）</label>
                            <input
                                ref={examNameInputRef}
                                list="exam-name-options"
                                value={examName}
                                onChange={(e) => handleExamNameChange(e.target.value)}
                                placeholder="可留空，保存时也可补充"
                                className="h-10 w-full rounded-lg border border-[#E1E8F2] bg-[#F9FBFF] px-2.5 text-[12px] font-semibold text-[#314967] outline-none focus:border-[#A9BCF2]"
                            />
                            <datalist id="exam-name-options">
                                {exams.map((exam) => (
                                    <option key={exam.id} value={exam.name} />
                                ))}
                            </datalist>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#8A98AE]">
                                    题号 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    ref={questionNoInputRef}
                                    value={questionNo}
                                    onChange={(e) => {
                                        setQuestionNo(e.target.value.trim());
                                        setFieldErrors((prev) => ({ ...prev, questionNo: undefined }));
                                    }}
                                    placeholder="如 13 或 13-1"
                                    className={`h-10 w-full rounded-lg bg-[#F9FBFF] px-2.5 text-[12px] font-semibold text-[#314967] outline-none ${fieldErrors.questionNo
                                        ? 'border border-red-300 ring-2 ring-red-100'
                                        : 'border border-[#E1E8F2] focus:border-[#A9BCF2]'
                                        }`}
                                />
                                {fieldErrors.questionNo && (
                                    <p className="text-[10px] font-bold text-red-500">{fieldErrors.questionNo}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-extrabold uppercase text-[#8A98AE]">
                                    总分 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    ref={totalScoreInputRef}
                                    type="number"
                                    min={1}
                                    value={totalScore}
                                    onChange={(e) => {
                                        setTotalScore(e.target.value);
                                        setFieldErrors((prev) => ({ ...prev, totalScore: undefined }));
                                    }}
                                    placeholder="输入分值"
                                    className={`h-10 w-full rounded-lg bg-[#F9FBFF] px-2.5 text-[12px] font-bold text-[#314967] outline-none ${fieldErrors.totalScore
                                        ? 'border border-red-300 ring-2 ring-red-100'
                                        : 'border border-[#E1E8F2] focus:border-[#A9BCF2]'
                                        }`}
                                />
                                {fieldErrors.totalScore && (
                                    <p className="text-[10px] font-bold text-red-500">{fieldErrors.totalScore}</p>
                                )}
                            </div>
                        </div>
                        <p className="rounded-lg border border-[#E3EAF6] bg-[#F8FAFF] px-2.5 py-2 text-[10px] font-semibold text-[#5C6F90]">
                            系统会根据图片自动拆分采分点并填充表格字段（问题词、得分点、分值、关键词）。
                        </p>
                    </div>
                </section>

                <section ref={uploadSectionRef} className="order-1">
                    <div className="mb-2 space-y-1.5 rounded-[12px] border border-[#DCE6F4] bg-[#F5F9FF] px-2.5 py-2.5">
                        <div className="inline-flex items-center gap-1 rounded-md bg-[#ECF7FF] px-2 py-0.5 text-[#2E62A9]">
                            <ImageIcon className="h-3 w-3" />
                            <h2 className="text-[11px] font-extrabold">步骤 1/3 · 上传评分图片</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label
                            ref={questionImageUploadRef}
                            onClick={() => setActiveUploadTarget('question')}
                            onDragOver={handleDragOver}
                            onDrop={handleDropUpload('question')}
                            className={`group relative flex aspect-[1/1.1] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 transition-all ${questionImage
                                ? 'border-[#8EA5E8] bg-[#EAF1FF]'
                                : activeUploadTarget === 'question'
                                    ? 'border-[#7A95E8] bg-[#EDF3FF] ring-2 ring-[#D3DFF8]'
                                    : fieldErrors.questionImage
                                        ? 'border-red-300 bg-red-50/30'
                                        : 'border-dashed border-[#DCE4F0] bg-[#F7FAFE] hover:border-[#8BA5E6] hover:bg-[#EDF3FF]'
                                }`}
                        >
                            {questionImage ? (
                                <>
                                    <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-black text-white">已上传</span>
                                    <img src={questionImage} alt="试题图片" className="h-full w-full rounded-[18px] object-contain p-2" />
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            setQuestionImage(null);
                                        }}
                                        className="absolute right-2 top-2 rounded-full bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        aria-label="移除试题图片"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Camera className={`h-5 w-5 ${activeUploadTarget === 'question' ? 'text-indigo-500' : 'text-[#94A3B8]'}`} />
                                    <span className={`text-[10px] font-extrabold ${activeUploadTarget === 'question' ? 'text-indigo-600' : 'text-[#64748B]'}`}>试题图片 *</span>
                                    <span className="text-[9px] font-bold text-slate-400">
                                        {activeUploadTarget === 'question' ? 'Ctrl+V 粘贴到此处' : '点击/拖拽上传'}
                                    </span>
                                </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('question')} />
                        </label>

                        <label
                            onClick={() => setActiveUploadTarget('answer')}
                            onDragOver={handleDragOver}
                            onDrop={handleDropUpload('answer')}
                            className={`group relative flex aspect-[1/1.1] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 transition-all ${answerImage
                                ? 'border-[#6D95E8] bg-[#EEF3FF]'
                                : activeUploadTarget === 'answer'
                                    ? 'border-[#7A95E8] bg-[#EDF3FF] ring-2 ring-[#D3DFF8]'
                                    : 'border-dashed border-[#DCE4F0] bg-[#F7FAFE] hover:border-[#8BA5E6] hover:bg-[#EDF3FF]'
                                }`}
                        >
                            {answerImage ? (
                                <>
                                    <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-black text-white">已上传</span>
                                    <img src={answerImage} alt="答案图片" className="h-full w-full rounded-[18px] object-contain p-2" />
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            setAnswerImage(null);
                                        }}
                                        className="absolute right-2 top-2 rounded-full bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        aria-label="移除答案图片"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <FileCheck2 className={`h-5 w-5 ${activeUploadTarget === 'answer' ? 'text-indigo-500' : 'text-blue-500'}`} />
                                    <span className={`text-[10px] font-extrabold ${activeUploadTarget === 'answer' ? 'text-indigo-600' : 'text-blue-500'}`}>参考答案</span>
                                    <span className="text-[9px] font-bold text-slate-400">
                                        {activeUploadTarget === 'answer' ? 'Ctrl+V 粘贴到此处' : '点击/拖拽上传'}
                                    </span>
                                </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('answer')} />
                        </label>
                    </div>

                    {fieldErrors.questionImage && (
                        <p className="mt-2 text-[10px] font-bold text-red-500">{fieldErrors.questionImage}</p>
                    )}
                </section>

            </div>

            <div className="shrink-0 border-t border-[#E0E7F1] bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/85">
                {showResetAsPrimaryCta ? (
                    <button
                        type="button"
                        onClick={handleResetForm}
                        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-extrabold text-rose-600 transition-colors hover:bg-rose-100"
                    >
                        <RotateCcw className="h-4 w-4" />
                        重新开始填写
                    </button>
                ) : (
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3E59C9] via-[#3A63D8] to-[#2753E5] text-[13px] font-black text-white shadow-[0_8px_18px_rgba(47,82,193,0.34)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在分析试题 (AI)...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                一键生成评分细则
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
