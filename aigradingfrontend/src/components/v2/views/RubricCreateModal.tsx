import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    Image as ImageIcon,
    FileText,
    Sparkles,
    Loader2,
    Trash2,
    Check
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages } from '@/services/rubric-service';
import { createRubricTemplate, recommendRubricTemplates, type RubricTemplate } from '@/services/rubric-templates';
import type { RubricJSONV3, ScoringStrategy, StrategyType, RubricPoint } from '@/types/rubric-v3';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import { toast } from '@/components/Toast';
import PointAccumulationEditor, { EditablePoint } from './rubric-editors/PointAccumulationEditor';
import SequentialLogicEditor, { EditablePoint as EditableStep } from './rubric-editors/SequentialLogicEditor';
import RubricMatrixEditor, { EditableDimension, EditableLevel } from './rubric-editors/RubricMatrixEditor';

interface RubricCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_NOTES = ['请根据得分点进行评分'];
const SUBJECT_OPTIONS = ['历史', '政治', '语文', '物理', '化学', '数学'];

// 学科-题型映射
const SUBJECT_QUESTION_TYPES: Record<string, string[]> = {
    '历史': ['填空题', '材料题', '论述题'],
    '政治': ['填空题', '材料题', '论述题'],
    '语文': ['填空题', '阅读理解', '作文', '文言文'],
    '物理': ['填空题', '计算题', '实验题'],
    '化学': ['填空题', '计算题', '实验题'],
    '数学': ['填空题', '计算题', '证明题'],
};
const DEFAULT_QUESTION_TYPES = ['填空题', '材料题', '论述题'];

// 学段选项
const GRADE_OPTIONS = [
    '七年级', '八年级', '九年级',
    '高一', '高二', '高三'
];

const RULE_TYPES = ['必含关键词', '禁用关键词', '替代答案', '扣分规则', '逻辑验证', '时空围栏'] as const;

type RuleType = (typeof RULE_TYPES)[number];
type SupplementRule = {
    id: string;
    type: RuleType;
    content: string;
};

function createRuleId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStrategyByType(typeLabel: string): ScoringStrategy {
    if (typeLabel.includes('选择')) {
        return {
            type: 'all',
            allowAlternative: false,
            strictMode: true,
            openEnded: false
        };
    }
    if (typeLabel.includes('材料')) {
        return {
            type: 'pick_n',
            maxPoints: 3,
            pointValue: 2,
            allowAlternative: true,
            strictMode: false,
            openEnded: false
        };
    }
    return {
        type: 'weighted',
        allowAlternative: true,
        strictMode: false,
        openEnded: false
    };
}

function normalizeKeywords(raw: string): string[] {
    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function toEditablePoints(points: RubricPoint[]): EditablePoint[] {
    return points.map((point, index) => ({
        id: point.id || `${index + 1}`,
        content: point.content || '',
        score: Number(point.score || 0).toString(),
        keywords: (point.keywords || []).join(', ')
    }));
}

function createEditablePoint(id: string): EditablePoint {
    return {
        id,
        content: '',
        score: '',
        keywords: ''
    };
}

function toRubricPoints(rows: EditablePoint[], questionId: string): RubricPoint[] {
    return rows.map((row, index) => {
        const fallbackId = questionId ? `${questionId}-${index + 1}` : `${index + 1}`;
        return {
            id: row.id || fallbackId,
            questionSegment: '',
            content: row.content || '',
            keywords: normalizeKeywords(row.keywords),
            score: Number(row.score) || 0
        };
    });
}

function splitNotes(notes: string[]) {
    const base: string[] = [];
    const supplements: SupplementRule[] = [];

    notes.forEach((note) => {
        const match = note.match(/^【([^】]+)】(.*)$/);
        if (match && RULE_TYPES.includes(match[1] as RuleType)) {
            supplements.push({
                id: createRuleId(),
                type: match[1] as RuleType,
                content: match[2]?.trim() || ''
            });
        } else {
            base.push(note);
        }
    });

    return { base, supplements };
}

function splitAlternativeRules(alternativeRules?: string) {
    if (!alternativeRules) return [];
    return alternativeRules
        .split(/[\n;；]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((content) => ({
            id: createRuleId(),
            type: '替代答案' as RuleType,
            content
        }));
}

export default function RubricCreateModal({ isOpen, onClose }: RubricCreateModalProps) {
    const {
        exams,
        rubricData,
        manualQuestionKey,
        detectedQuestionKey,
        saveRubric,
        setRubricConfig,
        createExamAction
    } = useAppStore();

    // 手动计算 currentQuestionKey，因为 getter 在解构时不会被调用
    const currentQuestionKey = manualQuestionKey || detectedQuestionKey;

    const [examName, setExamName] = useState('');
    const [subject, setSubject] = useState('历史');
    const [grade, setGrade] = useState('九年级');
    const [questionNo, setQuestionNo] = useState('');
    const [questionType, setQuestionType] = useState('填空题');
    const [totalScore, setTotalScore] = useState('');
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);
    const [questionImageName, setQuestionImageName] = useState('');
    const [answerImageName, setAnswerImageName] = useState('');
    const [rows, setRows] = useState<EditablePoint[]>([]);
    const [dimensions, setDimensions] = useState<EditableDimension[]>([]);
    const [strategyType, setStrategyType] = useState<StrategyType>('point_accumulation');
    const [requireOrder, setRequireOrder] = useState(true);
    const [scoringStrategy, setScoringStrategy] = useState<ScoringStrategy>(() => getStrategyByType('主观题'));
    const [baseNotes, setBaseNotes] = useState<string[]>(DEFAULT_NOTES);
    const [supplementRules, setSupplementRules] = useState<SupplementRule[]>([]);
    const [newRuleType, setNewRuleType] = useState<RuleType>(RULE_TYPES[0]);
    const [newRuleContent, setNewRuleContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateSuggestions, setTemplateSuggestions] = useState<RubricTemplate[]>([]);
    const [isRecommending, setIsRecommending] = useState(false);
    const initKeyRef = useRef<string | null>(null);

    const questionId = questionNo.trim();

    const totalFromRows = useMemo(() => {
        return rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    }, [rows]);

    const totalFromDimensions = useMemo(() => {
        return dimensions.reduce((sum, dim) => {
            const weight = Number(dim.weight);
            if (Number.isFinite(weight) && weight > 0) return sum + weight;
            const maxLevel = dim.levels.reduce((max, lvl) => Math.max(max, Number(lvl.score) || 0), 0);
            return sum + maxLevel;
        }, 0);
    }, [dimensions]);

    const constraints = useMemo(() => {
        const base = baseNotes
            .filter(Boolean)
            .map((note, index) => ({
                id: `note-${index + 1}`,
                type: '阅卷提示',
                description: note
            }));
        const supplements = supplementRules
            .filter((rule) => rule.content.trim())
            .map((rule) => ({
                id: rule.id,
                type: rule.type,
                description: rule.content.trim()
            }));
        return [...base, ...supplements];
    }, [baseNotes, supplementRules]);

    const previewRubric: RubricJSONV3 = useMemo(() => {
        const now = new Date().toISOString();
        const resolvedTotal = Number(totalScore)
            || (strategyType === 'rubric_matrix' ? totalFromDimensions : totalFromRows)
            || 0;
        const baseMeta = {
            questionId: questionId || 'Q',
            title: questionType || '未命名',
            subject,
            grade,
            questionType,
            examId: exams.find((exam) => exam.name === examName.trim())?.id || null,
            examName: examName.trim()
        };

        if (strategyType === 'rubric_matrix') {
            return {
                version: '3.0',
                metadata: baseMeta,
                strategyType,
                content: {
                    dimensions: dimensions.map((dim, idx) => ({
                        id: dim.id || `${questionId || 'Q'}-D${idx + 1}`,
                        name: dim.name || `维度${idx + 1}`,
                        weight: Number(dim.weight) || undefined,
                        levels: dim.levels.map((lvl) => ({
                            label: lvl.label || 'A',
                            score: Number(lvl.score) || 0,
                            description: lvl.description || ''
                        }))
                    })),
                    totalScore: resolvedTotal
                },
                constraints,
                createdAt: now,
                updatedAt: now
    };
}

function createEditableLevel(label: string): EditableLevel {
    return {
        label,
        score: '',
        description: ''
    };
}

function createEditableDimension(id: string): EditableDimension {
    return {
        id,
        name: '',
        weight: '',
        levels: [
            createEditableLevel('A'),
            createEditableLevel('B'),
            createEditableLevel('C')
        ]
    };
}

        const points = toRubricPoints(rows, questionId || 'Q');
        return {
            version: '3.0',
            metadata: baseMeta,
            strategyType,
            content: strategyType === 'sequential_logic'
                ? {
                    scoringStrategy,
                    steps: points.map((p, idx) => ({ ...p, order: idx + 1 })),
                    requireOrder,
                    totalScore: resolvedTotal
                }
                : {
                    scoringStrategy,
                    points,
                    totalScore: resolvedTotal
                },
            constraints,
            createdAt: now,
            updatedAt: now
        };
    }, [examName, exams, questionId, questionType, rows, scoringStrategy, totalFromRows, totalFromDimensions, totalScore, subject, grade, strategyType, requireOrder, dimensions, constraints]);

    const resetForm = useCallback(() => {
        setExamName('');
        setSubject('历史');
        setGrade('九年级');
        setQuestionNo('');
        setQuestionType('填空题');
        setTotalScore('');
        setQuestionImage(null);
        setAnswerImage(null);
        setQuestionImageName('');
        setAnswerImageName('');
        setRows([]);
        setDimensions([]);
        setScoringStrategy(getStrategyByType('填空题'));
        setStrategyType('point_accumulation');
        setRequireOrder(true);
        setBaseNotes(DEFAULT_NOTES);
        setSupplementRules([]);
        setTemplateSuggestions([]);
        setIsRecommending(false);
        setNewRuleType(RULE_TYPES[0]);
        setNewRuleContent('');
    }, []);

    useEffect(() => {
        if (!isOpen) {
            initKeyRef.current = null;
            return;
        }

        const key = currentQuestionKey || '';
        const data = key ? rubricData[key] : null;
        // 使用更详细的 signature，包含数据的实际内容哈希
        const dataHash = data ? JSON.stringify(data).length : 0;
        const signature = `${key}:${dataHash}`;

        // 如果 signature 相同，说明数据没有变化，无需重新加载
        if (initKeyRef.current === signature) return;

        // 调试：显示所有可用的 keys
        const allKeys = Object.keys(rubricData);
        console.log('[RubricCreateModal] === DEBUG ===');
        console.log('[RubricCreateModal] currentQuestionKey:', key);
        console.log('[RubricCreateModal] rubricData keys:', allKeys);
        console.log('[RubricCreateModal] data found:', !!data);
        if (data) {
            console.log('[RubricCreateModal] data content:', {
                questionId: data.metadata?.questionId,
                strategyType: data.strategyType,
                subject: data.metadata?.subject,
                pointCount: data.strategyType === 'rubric_matrix'
                    ? data.content?.dimensions?.length
                    : data.strategyType === 'sequential_logic'
                        ? data.content?.steps?.length
                        : data.content?.points?.length
            });
        }

        if (data) {
            let normalized: RubricJSONV3;
            try {
                normalized = coerceRubricToV3(data).rubric;
            } catch (error) {
                console.warn('[RubricCreateModal] Skip non-v3 rubric:', error);
                setRows([]);
                setDimensions([]);
                setTotalScore('');
                return;
            }
            const exam = exams.find((item) => item.id === normalized.metadata.examId);
            setExamName(exam?.name || normalized.metadata.examName || '');
            setSubject(normalized.metadata.subject || '历史');
            setGrade(normalized.metadata.grade || '九年级');
            setQuestionNo(normalized.metadata.questionId || '');
            const types = SUBJECT_QUESTION_TYPES[normalized.metadata.subject || '历史'] || DEFAULT_QUESTION_TYPES;
            const loadedType = normalized.metadata.questionType || types[0];
            setQuestionType(loadedType);
            setStrategyType(normalized.strategyType);

            if (normalized.strategyType === 'rubric_matrix') {
                setDimensions(
                    normalized.content.dimensions.map((dim, idx) => ({
                        id: dim.id || `${normalized.metadata.questionId}-D${idx + 1}`,
                        name: dim.name || '',
                        weight: dim.weight ? String(dim.weight) : '',
                        levels: dim.levels.map((lvl) => ({
                            label: lvl.label,
                            score: String(lvl.score ?? ''),
                            description: lvl.description || ''
                        }))
                    }))
                );
                setRows([]);
            } else {
                const rawPoints = normalized.strategyType === 'sequential_logic'
                    ? normalized.content.steps
                    : normalized.content.points;
                setRows(rawPoints.length ? toEditablePoints(rawPoints) : []);
                setDimensions([]);
                setRequireOrder(normalized.strategyType === 'sequential_logic' ? !!normalized.content.requireOrder : true);
            }

            const resolvedTotal = normalized.strategyType === 'rubric_matrix'
                ? normalized.content.totalScore || normalized.content.dimensions.reduce((sum, d) => sum + (d.weight || 0), 0)
                : normalized.strategyType === 'sequential_logic'
                    ? normalized.content.totalScore || normalized.content.steps.reduce((sum, p) => sum + p.score, 0)
                    : normalized.content.totalScore || normalized.content.points.reduce((sum, p) => sum + p.score, 0);
            setTotalScore(resolvedTotal ? String(resolvedTotal) : '');
            if (normalized.strategyType !== 'rubric_matrix') {
                setScoringStrategy(normalized.content.scoringStrategy || getStrategyByType(loadedType));
            }

            const base = normalized.constraints
                ?.filter((c) => c.type === '阅卷提示')
                .map((c) => c.description || '')
                .filter(Boolean) || DEFAULT_NOTES;
            const supplements = (normalized.constraints || [])
                .filter((c) => c.type !== '阅卷提示')
                .map((c) => ({
                    id: c.id || createRuleId(),
                    type: RULE_TYPES.includes(c.type as RuleType) ? (c.type as RuleType) : '扣分规则',
                    content: c.description || ''
                }));
            setBaseNotes(base.length ? base : DEFAULT_NOTES);
            setSupplementRules(supplements);
        } else {
            resetForm();
        }

        initKeyRef.current = signature;
    }, [currentQuestionKey, exams, isOpen, resetForm, rubricData]);

    const handleUpload = (type: 'question' | 'answer') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (type === 'question') {
                setQuestionImage(result);
                setQuestionImageName(file.name);
            } else {
                setAnswerImage(result);
                setAnswerImageName(file.name);
            }
        };
        reader.readAsDataURL(file);
    };

    const applyRubricToForm = (rubric: RubricJSONV3) => {
        setQuestionType(rubric.metadata.questionType || rubric.metadata.title || questionType);
        setSubject(rubric.metadata.subject || subject);
        setGrade(rubric.metadata.grade || grade);
        setStrategyType(rubric.strategyType);

        if (rubric.strategyType === 'rubric_matrix') {
            setDimensions(
                rubric.content.dimensions.map((dim, idx) => ({
                    id: dim.id || `${rubric.metadata.questionId}-D${idx + 1}`,
                    name: dim.name || '',
                    weight: dim.weight ? String(dim.weight) : '',
                    levels: dim.levels.map((lvl) => ({
                        label: lvl.label,
                        score: String(lvl.score ?? ''),
                        description: lvl.description || ''
                    }))
                }))
            );
            setRows([]);
        } else {
            const rawPoints = rubric.strategyType === 'sequential_logic'
                ? rubric.content.steps
                : rubric.content.points;
            setRows(Array.isArray(rawPoints) ? toEditablePoints(rawPoints) : []);
            setDimensions([]);
            setRequireOrder(rubric.strategyType === 'sequential_logic' ? !!rubric.content.requireOrder : true);
        }

        const resolvedTotal = rubric.strategyType === 'rubric_matrix'
            ? rubric.content.totalScore || rubric.content.dimensions.reduce((sum, d) => sum + (d.weight || 0), 0)
            : rubric.strategyType === 'sequential_logic'
                ? rubric.content.totalScore || rubric.content.steps.reduce((sum, p) => sum + p.score, 0)
                : rubric.content.totalScore || rubric.content.points.reduce((sum, p) => sum + p.score, 0);
        setTotalScore(resolvedTotal ? String(resolvedTotal) : '');

        if (rubric.strategyType !== 'rubric_matrix') {
            setScoringStrategy(rubric.content.scoringStrategy || getStrategyByType(rubric.metadata.questionType || questionType));
        }

        const base = rubric.constraints
            ?.filter((c) => c.type === '阅卷提示')
            .map((c) => c.description || '')
            .filter(Boolean) || DEFAULT_NOTES;
        const supplements = (rubric.constraints || [])
            .filter((c) => c.type !== '阅卷提示')
            .map((c) => ({
                id: c.id || createRuleId(),
                type: RULE_TYPES.includes(c.type as RuleType) ? (c.type as RuleType) : '扣分规则',
                content: c.description || ''
            }));
        setBaseNotes(base.length ? base : DEFAULT_NOTES);
        setSupplementRules(supplements);
    };

    const handleGenerate = async () => {
        if (!questionImage && !answerImage) {
            toast.error('请至少上传试题或参考答案图片');
            return;
        }
        if (!questionId) {
            toast.error('请先填写题号');
            return;
        }

        setIsGenerating(true);
        try {
            const rubric = await generateRubricFromImages(questionImage, answerImage, questionId);
            applyRubricToForm(rubric);
            toast.success('已生成评分细则');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '服务不可用';
            console.error('[RubricCreateModal] Generate error:', err);
            toast.error(`生成失败：${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRecommendTemplates = async () => {
        setIsRecommending(true);
        try {
            const templates = await recommendRubricTemplates({
                subject,
                questionType,
                strategyType
            });
            setTemplateSuggestions(templates);
            if (templates.length === 0) {
                toast.info('暂无匹配模板');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '推荐失败';
            console.error('[RubricCreateModal] Recommend error:', err);
            toast.error(message);
        } finally {
            setIsRecommending(false);
        }
    };

    const handleApplyTemplate = (tpl: RubricTemplate) => {
        const now = new Date().toISOString();
        const rubric: RubricJSONV3 = {
            version: '3.0',
            metadata: {
                ...tpl.metadata,
                questionId: questionId || tpl.metadata?.questionId || '',
                title: tpl.metadata?.title || questionType
            },
            strategyType: tpl.strategyType,
            content: tpl.content,
            constraints: [],
            createdAt: now,
            updatedAt: now
        };
        applyRubricToForm(rubric);
        toast.success('已应用模板');
    };

    const handleRowChange = (index: number, field: keyof EditablePoint, value: string) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const handleAddRow = () => {
        setRows((prev) => {
            const nextId = `${prev.length + 1}`;
            return [...prev, createEditablePoint(nextId)];
        });
    };

    const handleRemoveRow = (index: number) => {
        setRows((prev) => prev.filter((_, i) => i !== index));
    };

    const handleDimensionChange = (index: number, field: keyof EditableDimension, value: string) => {
        setDimensions((prev) => prev.map((dim, i) => (i === index ? { ...dim, [field]: value } : dim)));
    };

    const handleAddDimension = () => {
        setDimensions((prev) => {
            const nextId = `${questionId || 'Q'}-D${prev.length + 1}`;
            return [...prev, createEditableDimension(nextId)];
        });
    };

    const handleRemoveDimension = (index: number) => {
        setDimensions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleAddLevel = (dimIndex: number) => {
        setDimensions((prev) => prev.map((dim, i) => {
            if (i !== dimIndex) return dim;
            const nextLabel = String.fromCharCode(65 + dim.levels.length);
            return {
                ...dim,
                levels: [...dim.levels, createEditableLevel(nextLabel)]
            };
        }));
    };

    const handleRemoveLevel = (dimIndex: number, levelIndex: number) => {
        setDimensions((prev) => prev.map((dim, i) => {
            if (i !== dimIndex) return dim;
            return {
                ...dim,
                levels: dim.levels.filter((_, idx) => idx !== levelIndex)
            };
        }));
    };

    const handleChangeLevel = (
        dimIndex: number,
        levelIndex: number,
        field: keyof EditableLevel,
        value: string
    ) => {
        setDimensions((prev) => prev.map((dim, i) => {
            if (i !== dimIndex) return dim;
            return {
                ...dim,
                levels: dim.levels.map((lvl, idx) => (idx === levelIndex ? { ...lvl, [field]: value } : lvl))
            };
        }));
    };

    const handleAddSupplementRule = () => {
        if (!newRuleContent.trim()) {
            toast.error('请输入规则内容');
            return;
        }
        setSupplementRules((prev) => [
            ...prev,
            {
                id: createRuleId(),
                type: newRuleType,
                content: newRuleContent.trim()
            }
        ]);
        setNewRuleContent('');
    };

    const handleSupplementRuleChange = (id: string, updates: Partial<SupplementRule>) => {
        setSupplementRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule)));
    };

    const handleRemoveSupplementRule = (id: string) => {
        setSupplementRules((prev) => prev.filter((rule) => rule.id !== id));
    };

    const handleSave = async () => {
        if (!questionId) {
            toast.error('请填写题号');
            return;
        }
        if (strategyType === 'rubric_matrix' && dimensions.length === 0) {
            toast.error('请先生成或添加评分维度');
            return;
        }
        if (strategyType !== 'rubric_matrix' && rows.length === 0) {
            toast.error('请先生成或添加得分点');
            return;
        }

        setIsSaving(true);
        try {
            const trimmedExamName = examName.trim();
            let resolvedExamId: string | null = null;

            // 检查考试是否存在
            if (trimmedExamName) {
                const existingExam = exams.find((exam) => exam.name === trimmedExamName);
                if (existingExam) {
                    resolvedExamId = existingExam.id;
                } else {
                    // 自动创建新考试
                    const newExam = await createExamAction({
                        name: trimmedExamName,
                        subject: subject,
                        date: new Date().toISOString()
                    });
                    if (newExam) {
                        resolvedExamId = newExam.id;
                        toast.success(`已自动创建考试「${trimmedExamName}」`);
                    }
                }
            }

            // 构建最终的 rubric 对象，使用解析后的 examId
            const finalRubric: RubricJSONV3 = {
                ...previewRubric,
                metadata: {
                    ...previewRubric.metadata,
                    examId: resolvedExamId,
                    examName: trimmedExamName
                }
            };

            const questionKey = currentQuestionKey || `manual:${questionId}`;
            const content = JSON.stringify(finalRubric, null, 2);
            setRubricConfig(questionKey, finalRubric);
            await saveRubric(content, questionKey);
            toast.success('评分细则已保存');
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '请稍后重试';
            console.error('[RubricCreateModal] Save error:', err);
            toast.error(`保存失败：${message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!questionId) {
            toast.error('请填写题号');
            return;
        }
        if (strategyType === 'rubric_matrix' && dimensions.length === 0) {
            toast.error('请先生成或添加评分维度');
            return;
        }
        if (strategyType !== 'rubric_matrix' && rows.length === 0) {
            toast.error('请先生成或添加得分点');
            return;
        }

        setIsSavingTemplate(true);
        try {
            const trimmedExamName = examName.trim();
            const templateRubric: RubricJSONV3 = {
                ...previewRubric,
                metadata: {
                    ...previewRubric.metadata,
                    examId: null,
                    examName: trimmedExamName || previewRubric.metadata.examName
                }
            };
            await createRubricTemplate(templateRubric, 'user');
            toast.success('模板已保存到模板库');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '请稍后重试';
            console.error('[RubricCreateModal] Template save error:', err);
            toast.error(`保存模板失败：${message}`);
        } finally {
            setIsSavingTemplate(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full w-full bg-white flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div>
                        <h2 className="text-[13px] font-black text-slate-900">创建评分细则</h2>
                    </div>
                    <button
                        onClick={() => {
                            onClose();
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="关闭"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24 bg-slate-50 flex flex-col gap-3">
                    <div className="space-y-2">
                        {/* 第一行：考试、学科、考点 */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">考试</label>
                                <input
                                    list="exam-options"
                                    value={examName}
                                    onChange={(e) => setExamName(e.target.value)}
                                    placeholder="例如：2026 期末考试"
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium focus:border-indigo-400 outline-none"
                                />
                                <datalist id="exam-options">
                                    {exams.map((exam) => (
                                        <option key={exam.id} value={exam.name} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">学段</label>
                                <select
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium focus:border-indigo-400 outline-none"
                                >
                                    {GRADE_OPTIONS.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">学科</label>
                                <select
                                    value={subject}
                                    onChange={(e) => {
                                        const newSubject = e.target.value;
                                        setSubject(newSubject);
                                        // 联动更新题型
                                        const types = SUBJECT_QUESTION_TYPES[newSubject] || DEFAULT_QUESTION_TYPES;
                                        if (!types.includes(questionType)) {
                                            setQuestionType(types[0]);
                                            setScoringStrategy(getStrategyByType(types[0]));
                                        }
                                    }}
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium focus:border-indigo-400 outline-none"
                                >
                                    {SUBJECT_OPTIONS.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* 第二行：题号、总分、题型 */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">题号</label>
                                <input
                                    value={questionNo}
                                    onChange={(e) => setQuestionNo(e.target.value)}
                                    placeholder="12"
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">总分</label>
                                <input
                                    value={totalScore}
                                    onChange={(e) => setTotalScore(e.target.value)}
                                    placeholder="10"
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">题型</label>
                                <select
                                    value={questionType}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setQuestionType(value);
                                        setScoringStrategy(getStrategyByType(value));
                                    }}
                                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium focus:border-indigo-400 outline-none"
                                >
                                    {(SUBJECT_QUESTION_TYPES[subject] || DEFAULT_QUESTION_TYPES).map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <label className={`border border-dashed rounded-xl bg-white p-2 text-center flex flex-col items-center justify-center gap-1.5 min-h-[88px] cursor-pointer transition-colors ${questionImage ? 'border-green-400 bg-green-50/40' : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40'}`}>
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${questionImage ? 'bg-green-100' : 'bg-indigo-100'}`}>
                                    {questionImage ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                                    )}
                                </div>
                                <div className="text-[9px] font-bold text-slate-600">
                                    {questionImage ? (questionImageName || '试题已上传') : '上传试题'}
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload('question')} />
                            </label>
                            <label className={`border border-dashed rounded-xl bg-white p-2 text-center flex flex-col items-center justify-center gap-1.5 min-h-[88px] cursor-pointer transition-colors ${answerImage ? 'border-green-400 bg-green-50/40' : 'border-violet-200 hover:border-violet-400 hover:bg-violet-50/40'}`}>
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${answerImage ? 'bg-green-100' : 'bg-violet-100'}`}>
                                    {answerImage ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                        <FileText className="w-3.5 h-3.5 text-violet-500" />
                                    )}
                                </div>
                                <div className="text-[9px] font-bold text-slate-600">
                                    {answerImage ? (answerImageName || '答案已上传') : '上传答案'}
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload('answer')} />
                            </label>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[11px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-60"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isGenerating ? '生成中...' : '生成评分细则'}
                        </button>
                    </div>

                    {/* 模板推荐 */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-slate-600">模板推荐</div>
                            <button
                                onClick={handleRecommendTemplates}
                                disabled={isRecommending}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60"
                            >
                                {isRecommending ? '推荐中...' : '获取推荐'}
                            </button>
                        </div>
                        {templateSuggestions.length === 0 ? (
                            <div className="text-[9px] text-slate-400">暂无推荐模板，可先生成评分细则或保存模板</div>
                        ) : (
                            <div className="space-y-2">
                                {templateSuggestions.map((tpl) => (
                                    <div key={tpl.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg px-2.5 py-2">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-slate-700 truncate">
                                                {tpl.metadata?.title || tpl.metadata?.questionType || '未命名模板'}
                                            </div>
                                            <div className="text-[9px] text-slate-400">
                                                {tpl.metadata?.subject || '未设学科'} · {tpl.metadata?.questionType || '未知题型'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleApplyTemplate(tpl)}
                                            className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                        >
                                            应用
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 评分结构选择 */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="text-[10px] font-bold text-slate-600">评分结构</div>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setStrategyType('point_accumulation')}
                                className={`h-8 rounded-lg border text-[10px] font-bold transition-colors ${strategyType === 'point_accumulation' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'}`}
                            >
                                得分点累加
                            </button>
                            <button
                                onClick={() => setStrategyType('sequential_logic')}
                                className={`h-8 rounded-lg border text-[10px] font-bold transition-colors ${strategyType === 'sequential_logic' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600'}`}
                            >
                                步骤逻辑
                            </button>
                            <button
                                onClick={() => {
                                    setStrategyType('rubric_matrix');
                                    if (dimensions.length === 0) {
                                        setDimensions([createEditableDimension(`${questionId || 'Q'}-D1`)]);
                                    }
                                }}
                                className={`h-8 rounded-lg border text-[10px] font-bold transition-colors ${strategyType === 'rubric_matrix' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-orange-200 hover:text-orange-600'}`}
                            >
                                维度矩阵
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-400">
                            选择评分结构后可用不同的编辑器配置内容，矩阵适用于作文/综合题。
                        </p>
                    </div>

                    {strategyType !== 'rubric_matrix' && (
                        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700">
                                <span>⚙️ 评分策略</span>
                                <span className="text-amber-500 font-normal">（决定如何计算最终得分）</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-medium text-amber-600">评分类型</label>
                                    <select
                                        value={scoringStrategy.type}
                                        onChange={(e) => setScoringStrategy(prev => ({ ...prev, type: e.target.value as 'pick_n' | 'all' | 'weighted' }))}
                                        className="h-7 px-2 rounded-lg border border-amber-200 bg-white text-[10px] focus:border-amber-400 outline-none"
                                    >
                                        <option value="weighted">累加计分</option>
                                        <option value="pick_n">任选 N 点</option>
                                        <option value="all">全部答对</option>
                                    </select>
                                </div>
                                {scoringStrategy.type === 'pick_n' && (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-medium text-amber-600">最多计算</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={scoringStrategy.maxPoints || 1}
                                                onChange={(e) => setScoringStrategy(prev => ({ ...prev, maxPoints: Number(e.target.value) || 1 }))}
                                                placeholder="1"
                                                className="h-7 px-2 rounded-lg border border-amber-200 bg-white text-[10px] focus:border-amber-400 outline-none"
                                            />
                                            <span className="text-[8px] text-amber-500">个得分点</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-medium text-amber-600">每点分值</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={scoringStrategy.pointValue || 0}
                                                onChange={(e) => setScoringStrategy(prev => ({ ...prev, pointValue: Number(e.target.value) || 0 }))}
                                                placeholder="2"
                                                className="h-7 px-2 rounded-lg border border-amber-200 bg-white text-[10px] focus:border-amber-400 outline-none"
                                            />
                                            <span className="text-[8px] text-amber-500">分</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            {scoringStrategy.type === 'pick_n' && (
                                <div className="text-[9px] text-amber-600 bg-amber-100/50 p-2 rounded-lg">
                                    💡 <strong>任选 N 点</strong>：答对任意 {scoringStrategy.maxPoints || 1} 个得分点即得 {(scoringStrategy.maxPoints || 1) * (scoringStrategy.pointValue || 0)} 分。
                                    适用于「任答一点得满分」类题目。
                                </div>
                            )}
                            {scoringStrategy.type === 'weighted' && (
                                <div className="text-[9px] text-amber-600 bg-amber-100/50 p-2 rounded-lg">
                                    💡 <strong>累加计分</strong>：按各得分点分值累加。当前得分点合计 <strong>{totalFromRows}</strong> 分。
                                </div>
                            )}
                            {scoringStrategy.type === 'all' && (
                                <div className="text-[9px] text-amber-600 bg-amber-100/50 p-2 rounded-lg">
                                    💡 <strong>全部答对</strong>：必须答对所有得分点才得分。适用于填空题、选择题等客观题型。
                                </div>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={scoringStrategy.openEnded || false}
                                        onChange={(e) => setScoringStrategy(prev => ({ ...prev, openEnded: e.target.checked }))}
                                        className="w-3.5 h-3.5 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                                    />
                                    <span className="text-[9px] text-amber-600">开放题模式</span>
                                </label>
                                <span className="text-[8px] text-amber-400">（言之有理即得分）</span>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
                        {strategyType === 'rubric_matrix' ? (
                            <RubricMatrixEditor
                                dimensions={dimensions}
                                onChangeDimension={handleDimensionChange}
                                onRemoveDimension={handleRemoveDimension}
                                onAddDimension={handleAddDimension}
                                onAddLevel={handleAddLevel}
                                onRemoveLevel={handleRemoveLevel}
                                onChangeLevel={handleChangeLevel}
                            />
                        ) : strategyType === 'sequential_logic' ? (
                            <SequentialLogicEditor
                                steps={rows as EditableStep[]}
                                requireOrder={requireOrder}
                                onToggleOrder={setRequireOrder}
                                onChange={handleRowChange}
                                onAdd={handleAddRow}
                                onRemove={handleRemoveRow}
                            />
                        ) : (
                            <PointAccumulationEditor
                                points={rows}
                                onChange={handleRowChange}
                                onAdd={handleAddRow}
                                onRemove={handleRemoveRow}
                            />
                        )}
                        <div className="text-[9px] text-slate-400">
                            {strategyType === 'rubric_matrix'
                                ? <>维度合计：<span className="font-bold text-slate-600">{totalFromDimensions}</span> 分</>
                                : <>得分点合计：<span className="font-bold text-slate-600">{totalFromRows}</span> 分</>
                            }
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">补充规则</div>
                        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newRuleType}
                                    onChange={(e) => setNewRuleType(e.target.value as RuleType)}
                                    className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[10px] font-medium"
                                >
                                    {RULE_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={newRuleContent}
                                    onChange={(e) => setNewRuleContent(e.target.value)}
                                    placeholder="输入规则内容"
                                    className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                />
                            </div>
                            <button
                                onClick={handleAddSupplementRule}
                                className="w-full py-2 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold"
                            >
                                添加规则
                            </button>

                            {supplementRules.length === 0 ? (
                                <div className="text-[10px] text-slate-400">暂无补充规则</div>
                            ) : (
                                <div className="space-y-2">
                                    {supplementRules.map((rule) => (
                                        <div key={rule.id} className="flex items-center gap-2">
                                            <select
                                                value={rule.type}
                                                onChange={(e) => handleSupplementRuleChange(rule.id, { type: e.target.value as RuleType })}
                                                className="h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                            >
                                                {RULE_TYPES.map((type) => (
                                                    <option key={type} value={type}>
                                                        {type}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                value={rule.content}
                                                onChange={(e) => handleSupplementRuleChange(rule.id, { content: e.target.value })}
                                                className="flex-1 h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                            />
                                            <button
                                                onClick={() => handleRemoveSupplementRule(rule.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                aria-label="删除规则"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] border-t border-slate-200 bg-white/95 backdrop-blur flex flex-col gap-2 z-20">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleSaveTemplate}
                            disabled={isSavingTemplate}
                            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            {isSavingTemplate ? '保存中...' : '另存为模板'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isSaving ? '保存中...' : '保存评分细则'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
