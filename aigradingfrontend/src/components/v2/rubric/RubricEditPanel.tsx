/**
 * RubricEditPanel - 评分细则编辑面板 (Chrome Side Panel 适配版)
 * 
 * 集成新 UI 设计与现有 store 逻辑
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages } from '@/services/rubric-service';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import { toast } from '@/components/Toast';
import type { RubricJSONV3, RubricPoint } from '@/types/rubric-v3';
import StickyHeader from './StickyHeader';
import StickyFooter from './StickyFooter';
import AccordionCard, { ScorePoint } from './AccordionCard';
import {
    Plus,
    Upload,
    FileText,
    Sparkles,
    ChevronDown,
    X,
    Image as ImageIcon
} from 'lucide-react';
import { clsx } from 'clsx';

type ViewState = 'upload' | 'review';

interface RubricEditPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// 转换 RubricJSONV3 points 到 ScorePoint 格式
function toScorePoints(rubric: RubricJSONV3): ScorePoint[] {
    if (rubric.strategyType === 'rubric_matrix') {
        // 矩阵评分暂不支持手风琴编辑
        return [];
    }

    // 使用类型断言获取 points，因为 TypeScript 在联合类型上无法正确推断
    const content = rubric.content as { steps?: RubricPoint[]; points?: RubricPoint[] };
    const points = rubric.strategyType === 'sequential_logic'
        ? (content.steps || [])
        : (content.points || []);

    return points.map((p: RubricPoint) => ({
        id: p.id || `${Date.now()}-${Math.random()}`,
        title: p.content || '未命名得分点',
        score: p.score || 0,
        keywords: p.keywords || [],
        snippet: p.questionSegment || undefined,
        isRequired: false
    }));
}

// 转换 ScorePoint 回 RubricPoint 格式
function toRubricPoints(points: ScorePoint[], questionId: string): RubricPoint[] {
    return points.map((p, index) => ({
        id: p.id || `${questionId}-${index + 1}`,
        questionSegment: p.snippet || '',
        content: p.title,
        keywords: p.keywords,
        score: p.score
    }));
}

export default function RubricEditPanel({ isOpen, onClose }: RubricEditPanelProps) {
    const {
        rubricData,
        manualQuestionKey,
        detectedQuestionKey,
        saveRubric,
        setRubricConfig
    } = useAppStore();

    const currentQuestionKey = manualQuestionKey || detectedQuestionKey;

    // 视图状态
    const [viewState, setViewState] = useState<ViewState>('upload');
    const [scorePoints, setScorePoints] = useState<ScorePoint[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // 上传状态
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);
    const [questionFileName, setQuestionFileName] = useState('');
    const [answerFileName, setAnswerFileName] = useState('');

    // 元数据
    const [subject, setSubject] = useState('历史');
    const [grade, setGrade] = useState('九年级');
    const [questionNo, setQuestionNo] = useState('');
    const [questionType, setQuestionType] = useState('填空题');
    const [examName, setExamName] = useState('');

    // 原图预览
    const [showSourceImage, setShowSourceImage] = useState(false);

    // 加载现有数据
    useEffect(() => {
        if (!isOpen) return;

        const key = currentQuestionKey || '';
        const data = key ? rubricData[key] : null;

        if (data) {
            try {
                const normalized = coerceRubricToV3(data).rubric;
                const points = toScorePoints(normalized);

                setScorePoints(points);
                setSubject(normalized.metadata.subject || '历史');
                setGrade(normalized.metadata.grade || '九年级');
                setQuestionNo(normalized.metadata.questionId || '');
                setQuestionType(normalized.metadata.questionType || '填空题');
                setExamName(normalized.metadata.examName || '');

                if (points.length > 0) {
                    setViewState('review');
                    setExpandedId(points[0].id);
                }
            } catch (error) {
                console.warn('[RubricEditPanel] Failed to parse rubric:', error);
                setViewState('upload');
            }
        } else {
            // 重置为初始状态
            setViewState('upload');
            setScorePoints([]);
            setQuestionImage(null);
            setAnswerImage(null);
            setQuestionFileName('');
            setAnswerFileName('');
        }
    }, [isOpen, currentQuestionKey, rubricData]);

    // 计算总分
    const totalScore = useMemo(
        () => scorePoints.reduce((acc, curr) => acc + curr.score, 0),
        [scorePoints]
    );

    // 处理图片上传
    const handleUpload = (type: 'question' | 'answer') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (type === 'question') {
                setQuestionImage(result);
                setQuestionFileName(file.name);
            } else {
                setAnswerImage(result);
                setAnswerFileName(file.name);
            }
        };
        reader.readAsDataURL(file);
    };

    // AI 生成评分细则
    const handleGenerate = async () => {
        if (!questionImage && !answerImage) {
            toast.error('请至少上传试题或参考答案图片');
            return;
        }

        const questionId = questionNo || `Q${Date.now().toString().slice(-4)}`;

        setIsGenerating(true);
        try {
            const rubric = await generateRubricFromImages(questionImage, answerImage, questionId);
            const points = toScorePoints(rubric);

            setScorePoints(points);
            setSubject(rubric.metadata.subject || subject);
            setGrade(rubric.metadata.grade || grade);
            setQuestionNo(rubric.metadata.questionId || questionId);
            setQuestionType(rubric.metadata.questionType || questionType);

            setViewState('review');
            if (points.length > 0) {
                setExpandedId(points[0].id);
            }

            toast.success('已生成评分细则');
        } catch (error) {
            const message = error instanceof Error ? error.message : '服务不可用';
            console.error('[RubricEditPanel] Generate error:', error);
            toast.error(`生成失败：${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // 卡片操作
    const handleToggle = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    const handleChange = (id: string, updates: Partial<ScorePoint>) => {
        setScorePoints(prev =>
            prev.map(p => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const handleDelete = (id: string) => {
        setScorePoints(prev => prev.filter(p => p.id !== id));
        if (expandedId === id) {
            setExpandedId(null);
        }
    };

    const handleAddKeyword = (id: string, keyword: string) => {
        setScorePoints(prev =>
            prev.map(p =>
                p.id === id ? { ...p, keywords: [...p.keywords, keyword] } : p
            )
        );
    };

    const handleRemoveKeyword = (id: string, keyword: string) => {
        setScorePoints(prev =>
            prev.map(p =>
                p.id === id ? { ...p, keywords: p.keywords.filter(k => k !== keyword) } : p
            )
        );
    };

    const handleAddPoint = () => {
        const newId = `point-${Date.now()}`;
        const newPoint: ScorePoint = {
            id: newId,
            title: '新得分点',
            score: 1,
            keywords: [],
            isRequired: false
        };
        setScorePoints(prev => [...prev, newPoint]);
        setExpandedId(newId);
    };

    // 保存
    const handleSave = async () => {
        if (!questionNo) {
            toast.error('请填写题号');
            return;
        }
        if (scorePoints.length === 0) {
            toast.error('请先生成或添加得分点');
            return;
        }

        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const rubric: RubricJSONV3 = {
                version: '3.0',
                metadata: {
                    questionId: questionNo,
                    title: questionType,
                    subject,
                    grade,
                    questionType,
                    examId: null,
                    examName: examName || ''
                },
                strategyType: 'point_accumulation',
                content: {
                    scoringStrategy: {
                        type: 'weighted',
                        allowAlternative: true,
                        strictMode: false,
                        openEnded: false
                    },
                    points: toRubricPoints(scorePoints, questionNo),
                    totalScore
                },
                constraints: [],
                createdAt: now,
                updatedAt: now
            };

            const questionKey = currentQuestionKey || `manual:${questionNo}`;
            const content = JSON.stringify(rubric, null, 2);
            setRubricConfig(questionKey, rubric);
            await saveRubric(content, questionKey);

            toast.success('评分细则已保存');
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : '请稍后重试';
            console.error('[RubricEditPanel] Save error:', error);
            toast.error(`保存失败：${message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // --- 状态 A: 极简上传区 ---
    if (viewState === 'upload') {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="h-full w-full bg-[#F3F4F6] flex flex-col">
                    {/* Header */}
                    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                        <h1 className="text-base font-bold text-gray-800">创建评分细则</h1>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </header>

                    {/* Info Bar */}
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="text-xs font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer"
                            >
                                {['历史', '政治', '语文', '物理', '化学', '数学'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <span className="text-xs text-blue-400">/</span>
                            <select
                                value={grade}
                                onChange={e => setGrade(e.target.value)}
                                className="text-xs font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer"
                            >
                                {['七年级', '八年级', '九年级', '高一', '高二', '高三'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            <span className="text-xs text-blue-400">/</span>
                            <input
                                type="text"
                                value={questionNo}
                                onChange={e => setQuestionNo(e.target.value)}
                                placeholder="题号"
                                className="w-16 text-xs font-medium text-blue-600 bg-transparent border-none outline-none placeholder:text-blue-300"
                            />
                        </div>
                    </div>

                    {/* Upload Areas */}
                    <div className="flex-1 p-6 space-y-4 flex flex-col items-center justify-center overflow-y-auto">
                        <div className="w-full max-w-sm space-y-4">
                            {/* Upload Question */}
                            <label className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleUpload('question')}
                                />
                                <div className={clsx(
                                    'p-3 rounded-full group-hover:scale-110 transition-transform',
                                    questionImage ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'
                                )}>
                                    <FileText className="w-7 h-7" />
                                </div>
                                <p className="mt-3 font-bold text-gray-700">
                                    {questionFileName || '上传试题'}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {questionImage ? '点击更换' : '支持拍照或本地上传'}
                                </p>
                            </label>

                            {/* Upload Answer */}
                            <label className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleUpload('answer')}
                                />
                                <div className={clsx(
                                    'p-3 rounded-full group-hover:scale-110 transition-transform',
                                    answerImage ? 'bg-green-50 text-green-500' : 'bg-green-50 text-green-500'
                                )}>
                                    <Upload className="w-7 h-7" />
                                </div>
                                <p className="mt-3 font-bold text-gray-700">
                                    {answerFileName || '上传答案'}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {answerImage ? '点击更换' : '手写答案需清晰可辨'}
                                </p>
                            </label>
                        </div>

                        {/* AI Action */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full max-w-sm mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all transform active:scale-95 disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    AI 分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    ✨ AI 生成细则
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- 状态 B: 审核列表 ---
    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full w-full bg-[#F3F4F6] flex flex-col">
                {/* Sticky Header */}
                <StickyHeader
                    totalScore={totalScore}
                    currentScore={totalScore}
                    onBack={() => setViewState('upload')}
                    onViewSource={() => setShowSourceImage(true)}
                />

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                    {/* Metadata Bar */}
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{subject}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{grade}</span>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded">{questionType}</span>
                            <span className="ml-auto text-gray-400">第 {questionNo || '?'} 题</span>
                        </div>
                    </div>

                    {/* Score Point Cards */}
                    <div className="space-y-3">
                        {scorePoints.map((point, index) => (
                            <AccordionCard
                                key={point.id}
                                point={point}
                                index={index}
                                isExpanded={expandedId === point.id}
                                onToggle={() => handleToggle(point.id)}
                                onChange={updates => handleChange(point.id, updates)}
                                onDelete={() => handleDelete(point.id)}
                                onAddKeyword={kw => handleAddKeyword(point.id, kw)}
                                onRemoveKeyword={kw => handleRemoveKeyword(point.id, kw)}
                            />
                        ))}

                        {/* Add Point Button */}
                        <button
                            onClick={handleAddPoint}
                            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            添加得分点
                        </button>
                    </div>
                </main>

                {/* Sticky Footer */}
                <StickyFooter onSave={handleSave} isSaving={isSaving} />

                {/* Source Image Modal */}
                {showSourceImage && (questionImage || answerImage) && (
                    <div
                        className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
                        onClick={() => setShowSourceImage(false)}
                    >
                        <div className="max-w-full max-h-full overflow-auto">
                            {questionImage && (
                                <img src={questionImage} alt="试题原图" className="max-w-full rounded-lg shadow-2xl mb-4" />
                            )}
                            {answerImage && (
                                <img src={answerImage} alt="答案原图" className="max-w-full rounded-lg shadow-2xl" />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
