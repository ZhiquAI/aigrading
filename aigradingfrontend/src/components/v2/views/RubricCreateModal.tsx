import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    Image as ImageIcon,
    FileText,
    Sparkles,
    Loader2,
    Trash2
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages } from '@/services/rubric-service';
import type { AnswerPoint, RubricJSON, ScoringStrategy } from '@/types/rubric';
import { createEmptyAnswerPoint, createEmptyRubric } from '@/types/rubric';
import { toast } from '@/components/Toast';

interface RubricCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type EditablePoint = {
    id: string;
    content: string;
    score: string;
    keywords: string;
};

const DEFAULT_NOTES = ['请根据得分点进行评分'];
const SUBJECT_OPTIONS = ['历史', '政治', '语文', '物理', '化学', '数学'];
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

function toEditablePoints(points: AnswerPoint[]): EditablePoint[] {
    return points.map((point, index) => ({
        id: point.id || `${index + 1}`,
        content: point.content || '',
        score: Number(point.score || 0).toString(),
        keywords: (point.keywords || []).join(', ')
    }));
}

function toAnswerPoints(rows: EditablePoint[], questionId: string): AnswerPoint[] {
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
        currentQuestionKey,
        saveRubric,
        setRubricConfig
    } = useAppStore();

    const [examName, setExamName] = useState('');
    const [subject, setSubject] = useState('历史');
    const [questionNo, setQuestionNo] = useState('');
    const [questionType, setQuestionType] = useState('主观题');
    const [totalScore, setTotalScore] = useState('');
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);
    const [questionImageName, setQuestionImageName] = useState('');
    const [answerImageName, setAnswerImageName] = useState('');
    const [rows, setRows] = useState<EditablePoint[]>([]);
    const [scoringStrategy, setScoringStrategy] = useState<ScoringStrategy>(() => getStrategyByType('主观题'));
    const [baseNotes, setBaseNotes] = useState<string[]>(DEFAULT_NOTES);
    const [supplementRules, setSupplementRules] = useState<SupplementRule[]>([]);
    const [newRuleType, setNewRuleType] = useState<RuleType>(RULE_TYPES[0]);
    const [newRuleContent, setNewRuleContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const initKeyRef = useRef<string | null>(null);

    const questionId = questionNo.trim();

    const totalFromRows = useMemo(() => {
        return rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    }, [rows]);

    const supplementalNotes = useMemo(() => {
        return supplementRules
            .filter((rule) => rule.type !== '替代答案')
            .map((rule) => `【${rule.type}】${rule.content}`);
    }, [supplementRules]);

    const alternativeRules = useMemo(() => {
        const items = supplementRules
            .filter((rule) => rule.type === '替代答案')
            .map((rule) => rule.content.trim())
            .filter(Boolean);
        return items.length ? items.join('；') : undefined;
    }, [supplementRules]);

    const gradingNotes = useMemo(() => {
        const merged = [...baseNotes, ...supplementalNotes].filter(Boolean);
        return merged.length ? merged : DEFAULT_NOTES;
    }, [baseNotes, supplementalNotes]);

    const previewRubric: RubricJSON = useMemo(() => {
        const base = createEmptyRubric(questionId || 'Q');
        return {
            ...base,
            questionId: questionId || base.questionId,
            title: questionType || base.title,
            totalScore: Number(totalScore) || totalFromRows || base.totalScore,
            scoringStrategy: scoringStrategy || base.scoringStrategy,
            answerPoints: toAnswerPoints(rows, questionId),
            gradingNotes,
            alternativeRules,
            subject,
            examId: exams.find((exam) => exam.name === examName.trim())?.id || null,
            examName: examName.trim()
        } as RubricJSON;
    }, [examName, exams, gradingNotes, questionId, questionType, rows, scoringStrategy, totalFromRows, totalScore, subject, alternativeRules]);

    const resetForm = useCallback(() => {
        setExamName('');
        setSubject('历史');
        setQuestionNo('');
        setQuestionType('主观题');
        setTotalScore('');
        setQuestionImage(null);
        setAnswerImage(null);
        setQuestionImageName('');
        setAnswerImageName('');
        setRows([]);
        setScoringStrategy(getStrategyByType('主观题'));
        setBaseNotes(DEFAULT_NOTES);
        setSupplementRules([]);
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
        const signature = `${key}:${data ? 'loaded' : 'empty'}`;
        if (initKeyRef.current === signature) return;
        if (data) {
            const exam = exams.find((item) => item.id === data.examId);
            setExamName(exam?.name || '');
            setSubject(data.subject || '历史');
            setQuestionNo(data.questionId || data.questionNo || '');
            setQuestionType(data.title || '主观题');
            setTotalScore(data.totalScore ? String(data.totalScore) : '');
            setScoringStrategy(data.scoringStrategy || getStrategyByType(data.title || '主观题'));
            const notes = Array.isArray(data.gradingNotes) ? data.gradingNotes : DEFAULT_NOTES;
            const { base, supplements } = splitNotes(notes);
            const altSupplements = splitAlternativeRules(data.alternativeRules);
            setBaseNotes(base.length ? base : DEFAULT_NOTES);
            setSupplementRules([...supplements, ...altSupplements]);
            const rawPoints = Array.isArray(data.answerPoints)
                ? data.answerPoints
                : Array.isArray(data.points)
                    ? data.points
                    : [];
            setRows(rawPoints.length ? toEditablePoints(rawPoints) : []);
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
            setQuestionType(rubric.title || questionType);
            setTotalScore(rubric.totalScore ? String(rubric.totalScore) : '');
            setScoringStrategy(rubric.scoringStrategy || getStrategyByType(rubric.title || questionType));
            const notes = rubric.gradingNotes && rubric.gradingNotes.length ? rubric.gradingNotes : DEFAULT_NOTES;
            const { base, supplements } = splitNotes(notes);
            const altSupplements = splitAlternativeRules(rubric.alternativeRules);
            setBaseNotes(base.length ? base : DEFAULT_NOTES);
            setSupplementRules([...supplements, ...altSupplements]);
            setRows(Array.isArray(rubric.answerPoints) ? toEditablePoints(rubric.answerPoints) : []);
            toast.success('已生成评分细则');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '服务不可用';
            console.error('[RubricCreateModal] Generate error:', err);
            toast.error(`生成失败：${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRowChange = (index: number, field: keyof EditablePoint, value: string) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const handleAddRow = () => {
        setRows((prev) => {
            const nextId = `${(prev.length + 1).toString()}`;
            const newPoint = createEmptyAnswerPoint(nextId);
            return [...prev, ...toEditablePoints([newPoint])];
        });
    };

    const handleRemoveRow = (index: number) => {
        setRows((prev) => prev.filter((_, i) => i !== index));
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
        if (rows.length === 0) {
            toast.error('请先生成或添加得分点');
            return;
        }

        setIsSaving(true);
        try {
            const questionKey = currentQuestionKey || `manual:${questionId}`;
            const content = JSON.stringify(previewRubric, null, 2);
            setRubricConfig(questionKey, previewRubric);
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
                    <div className="space-y-1.5">
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-[1.35fr_0.65fr] gap-1.5">
                                <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-bold text-slate-500 w-6 shrink-0">考试</label>
                                    <div className="flex-1">
                                        <input
                                            list="exam-options"
                                            value={examName}
                                            onChange={(e) => setExamName(e.target.value)}
                                            placeholder="例如：2026 期末考试"
                                            className="w-full h-7 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-medium focus:border-indigo-400 outline-none"
                                        />
                                        <datalist id="exam-options">
                                            {exams.map((exam) => (
                                                <option key={exam.id} value={exam.name} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-bold text-slate-500 w-6 shrink-0">学科</label>
                                    <select
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full h-7 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-medium focus:border-indigo-400 outline-none"
                                    >
                                        {SUBJECT_OPTIONS.map((item) => (
                                            <option key={item} value={item}>
                                                {item}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                                <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-bold text-slate-500 w-6 shrink-0">题号</label>
                                    <input
                                        value={questionNo}
                                        onChange={(e) => setQuestionNo(e.target.value)}
                                        placeholder="12"
                                        className="w-full h-7 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-bold text-slate-500 w-6 shrink-0">总分</label>
                                    <input
                                        value={totalScore}
                                        onChange={(e) => setTotalScore(e.target.value)}
                                        placeholder="10"
                                        className="w-full h-7 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-bold text-slate-500 w-6 shrink-0">题型</label>
                                    <input
                                        list="question-type-options"
                                        value={questionType}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setQuestionType(value);
                                            setScoringStrategy(getStrategyByType(value));
                                        }}
                                        placeholder="主观题"
                                        className="w-full h-7 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-medium focus:border-indigo-400 outline-none"
                                    />
                                    <datalist id="question-type-options">
                                        <option value="主观题" />
                                        <option value="选择题" />
                                        <option value="材料解析" />
                                        <option value="论述题" />
                                    </datalist>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <label className="border border-dashed border-indigo-200 rounded-xl bg-white p-2 text-center flex flex-col items-center justify-center gap-1.5 min-h-[88px] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
                                <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                                <div className="text-[9px] font-bold text-slate-600">上传试题</div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload('question')} />
                            </label>
                            <label className="border border-dashed border-violet-200 rounded-xl bg-white p-2 text-center flex flex-col items-center justify-center gap-1.5 min-h-[88px] cursor-pointer hover:border-violet-400 hover:bg-violet-50/40 transition-colors">
                                <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                                    <FileText className="w-3.5 h-3.5 text-violet-500" />
                                </div>
                                <div className="text-[9px] font-bold text-slate-600">上传答案</div>
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

                    <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto flex-1 min-h-[200px]">
                            <table className="w-full text-[10px]">
                                <thead className="text-slate-400">
                                    <tr>
                                        <th className="text-left px-2 py-2">ID</th>
                                        <th className="text-left px-2 py-2">得分点</th>
                                        <th className="text-left px-2 py-2">分值</th>
                                        <th className="text-left px-2 py-2">关键词</th>
                                        <th className="text-left px-2 py-2">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                                暂无得分点，可先生成评分细则
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((row, index) => (
                                        <tr key={`${row.id}-${index}`} className="border-t border-slate-100">
                                            <td className="px-2 py-2">
                                                <input
                                                    value={row.id}
                                                    onChange={(e) => handleRowChange(index, 'id', e.target.value)}
                                                className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-[9px]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    value={row.content}
                                                    onChange={(e) => handleRowChange(index, 'content', e.target.value)}
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[9px]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    value={row.score}
                                                    onChange={(e) => handleRowChange(index, 'score', e.target.value)}
                                                    className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-[9px]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    value={row.keywords}
                                                    onChange={(e) => handleRowChange(index, 'keywords', e.target.value)}
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[9px]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <button
                                                    onClick={() => handleRemoveRow(index)}
                                                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    aria-label="删除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-100">
                                        <td colSpan={5} className="px-2 py-2">
                                            <button
                                                onClick={handleAddRow}
                                                className="w-full h-8 rounded-lg border border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors"
                                                aria-label="新增行"
                                            >
                                                <span className="text-lg font-bold leading-none">+</span>
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="text-[9px] text-slate-400">
                            得分点合计：<span className="font-bold text-slate-600">{totalFromRows}</span> 分
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
    );
}
