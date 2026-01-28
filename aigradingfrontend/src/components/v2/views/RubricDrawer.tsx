import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Sparkles,
    Plus,
    Save,
    Trash2,
    Minus,
    Check,
    FileJson,
    Upload,
    Download,
    ShieldCheck,
    Info,
    PlusCircle,
    ChevronLeft,
    Search,
    MoreHorizontal,
    Edit3,
    AlertTriangle,
    Wand2,
    ListPlus,
    ChevronRight,
    ArrowLeft,
    Type,
    Clipboard,
    Image as ImageIcon,
    Loader2
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { generateRubricFromImages, generateRubricFromText } from '@/services/rubric-service';

// --- Types (aligned with new JSON) ---
interface RubricPoint {
    id: string;
    questionSegment?: string; // --- NEW: 问题词 (e.g., 根本原因, 特点) ---
    content: string; // "涉及..."
    keywords: string[]; // ["封建专制", "阻碍"]
    requiredKeywords?: string[]; // ["封建专制"]
    score: number;
    deductionRules?: string; // "必须提到..."
    openEnded?: boolean;
}

interface RubricConfig {
    id?: string;
    questionNo?: string;
    alias?: string;
    points: RubricPoint[];
    anchorKeywords: string[]; // Kept for Shield Box
    examId?: string | null;
}

interface RubricDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function RubricDrawer({ isOpen, onClose }: RubricDrawerProps) {
    const {
        currentQuestionKey,
        rubricLibrary,
        rubricData,
        selectQuestion,
        // createRubricQuestion, // We use getState() directly
        setRubricConfig,
        saveRubric,
        exams,
        activeExamId
    } = useAppStore();

    // DEBUG: Inspect the store instance
    useEffect(() => {
        console.log('[RubricDrawer] Full Store Instance:', useAppStore.getState());
        // console.log('[RubricDrawer] addQuestionToLibrary type:', typeof addQuestionToLibrary);
    }, []);

    const [viewStack, setViewStack] = useState<('library' | 'detail' | 'point_editor' | 'question_settings' | 'editor')[]>(['library']);
    const currentView = viewStack[viewStack.length - 1];

    const [isVisible, setIsVisible] = useState(false);

    // Active Data
    const [activeConfig, setActiveConfig] = useState<RubricConfig>({ points: [], anchorKeywords: [] });

    // Editor State
    const [editingPoint, setEditingPoint] = useState<RubricPoint | null>(null);
    const [newKeyword, setNewKeyword] = useState('');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // --- Text Import State ---
    const [showTextImport, setShowTextImport] = useState(false);
    const [rubricTextInput, setRubricTextInput] = useState('');

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setViewStack(['library']);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (currentView === 'detail' && currentQuestionKey) {
            // Defensive access
            const data = (rubricData || {})[currentQuestionKey];
            const libraryItem = (rubricLibrary || []).find(i => i && i.id === currentQuestionKey);

            if (data) {
                // We have full config
                setActiveConfig({
                    id: currentQuestionKey,
                    questionNo: data.questionNo || currentQuestionKey,
                    alias: data.alias || libraryItem?.alias || '未命名',
                    points: Array.isArray(data.points) ? data.points : [],
                    anchorKeywords: Array.isArray(data.anchorKeywords) ? data.anchorKeywords : (libraryItem?.keywords || []),
                    examId: data.examId || (libraryItem as any)?.examId || activeExamId
                });
            } else if (libraryItem) {
                // Initialize if empty in rubricData but exists in Library
                setActiveConfig({
                    id: libraryItem.id,
                    questionNo: libraryItem.questionNo,
                    alias: libraryItem.alias,
                    points: [],
                    anchorKeywords: libraryItem.keywords || [],
                    examId: (libraryItem as any)?.examId || activeExamId
                });
            }
        }
    }, [currentView, currentQuestionKey, rubricData, rubricLibrary]);

    // --- Navigation ---
    const pushView = (view: 'library' | 'detail' | 'point_editor' | 'question_settings' | 'editor') => setViewStack(p => [...p, view]);
    const popView = () => setViewStack(p => p.length > 1 ? p.slice(0, p.length - 1) : p);

    const handleSelectQuestion = (id: string) => {
        console.log('[RubricDrawer] handleSelectQuestion', id);
        if (id === 'new') {
            try {
                const currentLib = Array.isArray(rubricLibrary) ? rubricLibrary : [];
                console.log('[RubricDrawer] Checked Lib (isArray):', Array.isArray(currentLib), currentLib);

                let maxId = 0;
                for (const item of currentLib) {
                    if (item && item.questionNo) {
                        const num = parseInt(item.questionNo);
                        if (!isNaN(num) && num > maxId) {
                            maxId = num;
                        }
                    }
                }

                const newId = (maxId + 1).toString();
                console.log('[RubricDrawer] Generated ID:', newId);

                // Force use of direct store state to avoid hook staleness
                const store = useAppStore.getState();

                if (typeof store.createRubricQuestion !== 'function') {
                    console.error('Store contents:', store);
                    throw new Error('Store action: createRubricQuestion is not a function');
                }

                store.createRubricQuestion({ questionNo: newId, alias: '新题目' });
                console.log('[RubricDrawer] Action dispatched');

                // Initialize local config for the new question
                setActiveConfig({
                    id: id,
                    questionNo: newId,
                    alias: '新题目',
                    points: [],
                    anchorKeywords: [],
                    examId: activeExamId
                });

                pushView('editor');
            } catch (e: any) {
                console.error('[RubricDrawer] Error creating question:', e);
                // Show exact error message to user
                toast.error(`创建失败: ${e?.message || '未知错误'}`);
            }
        } else {
            selectQuestion(id);
            // 直接进入合并的 editor 视图
            pushView('editor');
        }
    };

    // --- Editor Actions ---
    const handleEditPoint = (point: RubricPoint) => {
        setEditingPoint({ ...point });
        pushView('point_editor');
    };

    const handleAddPoint = () => {
        setEditingPoint({
            id: Date.now().toString(),
            content: '',
            keywords: [],
            score: 1,
            openEnded: false
        });
        pushView('point_editor');
    };

    const handleSavePoint = () => {
        if (!editingPoint) return;
        setActiveConfig(prev => {
            const exists = prev.points.find(p => p.id === editingPoint.id);
            const newPoints = exists
                ? prev.points.map(p => p.id === editingPoint.id ? editingPoint : p)
                : [...prev.points, editingPoint];
            return { ...prev, points: newPoints };
        });
        popView();
    };

    const handleDeletePoint = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActiveConfig(prev => ({
            ...prev,
            points: prev.points.filter(p => p.id !== id)
        }));
    };

    // --- Keyword Helpers ---
    const handleAddKeyword = () => {
        if (newKeyword.trim() && editingPoint) {
            setEditingPoint({
                ...editingPoint,
                keywords: [...editingPoint.keywords, newKeyword.trim()]
            });
            setNewKeyword('');
        }
    };

    const removeKeyword = (kw: string) => {
        if (editingPoint) {
            setEditingPoint({
                ...editingPoint,
                keywords: editingPoint.keywords.filter(k => k !== kw)
            });
        }
    };

    const handleSaveRubric = async () => {
        try {
            const lastPoints = activeConfig.points.map(p => ({
                ...p,
                desc: p.content // Map back content to desc for backward compat store
            }));

            const fullConfig = {
                questionNo: activeConfig.questionNo,
                alias: activeConfig.alias,
                subject: 'history',
                type: 'short_answer',
                anchorKeywords: activeConfig.anchorKeywords.length > 0
                    ? activeConfig.anchorKeywords
                    : Array.from(new Set(lastPoints.slice(0, 3).flatMap(p => p.keywords || []))).slice(0, 5),
                points: lastPoints,
                examId: activeConfig.examId,
                globalPreferences: { handwritingScore: true, spellingStrictness: 'low' }
            };

            if (currentQuestionKey) {
                setRubricConfig(currentQuestionKey, fullConfig as any);
                await saveRubric(JSON.stringify(fullConfig, null, 2), currentQuestionKey);
            }
            toast.success("评分细则已保存");
        } catch (e) {
            console.error(e);
            toast.error("保存失败");
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setUploadedImage(ev.target.result as string);
                toast.success("图片已上传");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAIGen = async () => {
        if (!uploadedImage) {
            toast.error("请先上传题目图片");
            return;
        }

        setIsGenerating(true);
        try {
            // Call the real API - Pass the human-readable question No (e.g., "115")
            const rubric = await generateRubricFromImages(null, uploadedImage, activeConfig.questionNo || 'unknown');

            // Map RubricJSON v2 to RubricConfig
            const newPoints: RubricPoint[] = rubric.answerPoints.map(p => {
                let finalId = p.id;
                let finalSegment = p.questionSegment || (p as any).segment || (p as any).questionWord || '';

                // FIX: If ID contains non-numeric parts (e.g., "15-1-根本原因"), split them
                if (finalId.includes('-')) {
                    const parts = finalId.split('-');
                    const lastPart = parts[parts.length - 1];
                    // If the last part is Chinese characters, it's likely a segment that leaked in
                    if (/[\u4e00-\u9fa5]/.test(lastPart)) {
                        if (!finalSegment) finalSegment = lastPart;
                        finalId = parts.slice(0, -1).join('-');
                    }
                }

                return {
                    id: finalId,
                    questionSegment: finalSegment,
                    content: p.content,
                    keywords: p.keywords,
                    requiredKeywords: p.requiredKeywords,
                    score: p.score,
                    deductionRules: p.deductionRules,
                    openEnded: p.openEnded
                };
            });

            setActiveConfig(prev => ({
                ...prev,
                points: newPoints,
                totalScore: rubric.totalScore
            }));

            toast.success("AI 已基于图片生成结构化细则");
        } catch (e: any) {
            console.error('[RubricDrawer] AI Gen Error:', e);
            toast.error(`生成失败: ${e.message || '服务不可用'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleTextImport = async () => {
        if (!rubricTextInput.trim()) {
            toast.error("内容不能为空");
            return;
        }
        setIsGenerating(true);
        setShowTextImport(false);
        try {
            const rubric = await generateRubricFromText(rubricTextInput, activeConfig.questionNo || 'unknown');
            const newPoints: RubricPoint[] = rubric.answerPoints.map(p => {
                let finalId = p.id;
                let finalSegment = p.questionSegment || (p as any).segment || (p as any).questionWord || '';

                if (finalId.includes('-')) {
                    const parts = finalId.split('-');
                    const lastPart = parts[parts.length - 1];
                    if (/[\u4e00-\u9fa5]/.test(lastPart)) {
                        if (!finalSegment) finalSegment = lastPart;
                        finalId = parts.slice(0, -1).join('-');
                    }
                }

                return {
                    id: finalId,
                    questionSegment: finalSegment,
                    content: p.content,
                    keywords: p.keywords,
                    requiredKeywords: p.requiredKeywords,
                    score: p.score,
                    deductionRules: p.deductionRules,
                    openEnded: p.openEnded
                };
            });

            setActiveConfig(prev => ({
                ...prev,
                points: newPoints,
                totalScore: rubric.totalScore
            }));
            setRubricTextInput('');
            toast.success("AI 已基于文本解析评分细则");
        } catch (e: any) {
            toast.error(`解析失败: ${e.message || '服务不可用'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isVisible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex flex-col justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            <div
                className={`
                    relative w-full h-[95vh] bg-white rounded-t-[24px] shadow-2xl flex flex-col overflow-hidden 
                    transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                `}
            >
                <div className="w-full flex justify-center pt-3 pb-1 shrink-0 cursor-pointer hover:bg-slate-50 transition-colors" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                </div>

                {/* --- VIEW 1: LIBRARY --- */}
                <div className={`absolute inset-0 top-6 flex flex-col bg-white transition-transform duration-300 ${currentView === 'library' ? 'translate-x-0' : '-translate-x-1/3 opacity-0 pointer-events-none'}`}>
                    <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-white">
                        <h1 className="font-bold text-slate-800 text-base">考试汇总管理</h1>
                        <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" onClick={() => handleSelectQuestion('new')}>
                            <Plus className="w-4 h-4" />
                        </button>
                    </header>
                    <div className="p-4 flex-1 overflow-y-auto space-y-3">
                        {(!rubricLibrary || rubricLibrary.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <FileJson className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-600">暂无汇总记录</h3>
                                <p className="text-xs text-slate-400 mt-2 mb-6 max-w-[200px]">您的汇总管理尚未初始化或已被清空。</p>
                                <button
                                    onClick={() => handleSelectQuestion('new')}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all"
                                >
                                    新建汇总
                                </button>
                            </div>
                        ) : (
                            (rubricLibrary || []).map(item => {
                                // 使用 useMemo 缓存计算结果，避免每次渲染都重新计算
                                const data = useMemo(() => (rubricData || {})[item.id], [rubricData, item.id]);
                                const examId = useMemo(() => data?.examId || (item as any).examId, [data, item]);
                                const exam = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);

                                return (
                                    <div key={item.id} onClick={() => handleSelectQuestion(item.id)} className={`relative border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${item.isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border ${item.isActive ? 'bg-white text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500'}`}>{item.questionNo}</div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-800">{item.alias}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {exam ? (
                                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded border border-indigo-100">
                                                            {exam.name}
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold rounded border border-slate-100">
                                                            未归类
                                                        </span>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{item.keywords.join(' · ') || '无关键词'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* --- VIEW 2: DETAIL (TABLE) --- */}
                <div className={`absolute inset-0 top-6 flex flex-col bg-white transition-transform duration-300 ${currentView === 'detail' ? 'translate-x-0' : currentView === 'library' ? 'translate-x-full' : '-translate-x-1/3 opacity-0 pointer-events-none'}`}>
                    <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-white">
                        <div className="flex items-center gap-2">
                            <button className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg" onClick={popView}><ChevronLeft className="w-5 h-5" /></button>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">{activeConfig.questionNo} - {activeConfig.alias}</span>
                                <span className="text-[10px] text-slate-400">表格视图</span>
                            </div>
                        </div>
                        <button onClick={handleSaveRubric} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">保存</button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin pb-24">

                        {/* AI Assistant Section (Compressed) */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-3 rounded-xl border border-indigo-100 shadow-sm mb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tighter">AI 智能辅助</p>
                                        <p className="text-[9px] text-slate-400">基于图片自动生成评分明细</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!uploadedImage ? (
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                                                <button
                                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                                                >
                                                    <ImageIcon className="w-3 h-3" /> 图片导入
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => setShowTextImport(true)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Type className="w-3 h-3 text-indigo-600" /> 文本/粘贴
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-8 h-8 rounded border border-indigo-200 overflow-hidden group">
                                                <img src={uploadedImage} className="w-full h-full object-cover" />
                                                <button onClick={() => setUploadedImage(null)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <X className="w-3 h-3 text-white" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleAIGen}
                                                disabled={isGenerating}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                                            >
                                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                {isGenerating ? '生成中...' : '重新生成'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">评分细则表 ({activeConfig.points.length})</h3>
                            <button onClick={handleAddPoint} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded"><PlusCircle className="w-3.5 h-3.5" /> 新增行</button>
                        </div>

                        {/* The Table - Refactored for Horizontal Scroll & Flexibility */}
                        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm bg-white scrollbar-thin">
                            <div className="min-w-[800px]">
                                <div className="flex bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 h-9 items-center">
                                    <div className="w-[80px] text-center border-r border-slate-100 flex-shrink-0">题号</div>
                                    <div className="w-[100px] px-3 border-r border-slate-100 flex-shrink-0">问题词</div>
                                    <div className="w-[50px] text-center border-r border-slate-100 flex-shrink-0">分值</div>
                                    <div className="flex-1 min-w-[300px] px-3 border-r border-slate-100">参考答案</div>
                                    <div className="w-[150px] px-3 border-r border-slate-100 flex-shrink-0">核心关键词</div>
                                    <div className="w-[150px] px-3 border-r border-slate-100 text-amber-600 flex-shrink-0">扣分原则</div>
                                    <div className="w-[60px] text-center flex-shrink-0">操作</div>
                                </div>

                                {activeConfig.points.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-slate-400">暂无数据，请上传图片生成或手动添加</div>
                                ) : (
                                    (activeConfig.points || []).map((point, idx) => (
                                        <div
                                            key={point.id}
                                            className={`flex text-xs border-b border-slate-100 last:border-0 hover:bg-indigo-50/30 transition-colors group cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                            onClick={() => handleEditPoint(point)}
                                        >
                                            <div className="w-[80px] flex items-center justify-center border-r border-slate-100 py-3 px-1 font-mono text-[9px] text-slate-400 leading-tight text-center flex-shrink-0 overflow-hidden">
                                                {point.id}
                                            </div>
                                            <div className="w-[100px] flex items-center px-3 border-r border-slate-100 py-3 font-bold text-indigo-700 bg-indigo-50/20 text-[10px] flex-shrink-0 truncate" title={point.questionSegment}>
                                                {point.questionSegment || '-'}
                                            </div>
                                            <div className="w-[50px] flex items-center justify-center border-r border-slate-100 py-3 font-bold text-slate-700 flex-shrink-0">
                                                {point.score}
                                            </div>
                                            <div className="flex-1 min-w-[300px] px-3 py-3 border-r border-slate-100 text-slate-600 leading-normal text-[11px]">
                                                {point.content || '无描述'}
                                            </div>
                                            <div className="w-[150px] px-3 py-3 border-r border-slate-100 flex flex-wrap gap-1 content-start flex-shrink-0">
                                                {point.keywords.map(k => (
                                                    <span key={k} className="text-[9px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded leading-none">{k}</span>
                                                ))}
                                                {point.keywords.length === 0 && <span className="text-[10px] text-slate-300 italic">无</span>}
                                            </div>
                                            <div className="w-[150px] px-3 py-3 border-r border-slate-100 text-[10px] text-amber-600 leading-tight italic flex-shrink-0 whitespace-normal break-words">
                                                {point.deductionRules || '-'}
                                            </div>
                                            <div className="w-[60px] flex items-center justify-center flex-shrink-0">
                                                <button
                                                    onClick={(e) => handleDeletePoint(e, point.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- VIEW 4: QUESTION SETTINGS --- */}
                <div className={`absolute inset-0 top-6 flex flex-col bg-slate-50 transition-transform duration-300 ${currentView === 'question_settings' ? 'translate-x-0' : currentView === 'library' ? 'translate-x-full' : '-translate-x-full opacity-0 pointer-events-none'}`}>
                    <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-white">
                        <div className="flex items-center gap-2">
                            <button className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg" onClick={popView}><ChevronLeft className="w-5 h-5" /></button>
                            <h2 className="font-bold text-slate-800 text-sm">题目基础设置</h2>
                        </div>
                        <button onClick={() => pushView('detail')} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1">下一步 <ChevronRight className="w-3.5 h-3.5" /></button>
                    </header>
                    <div className="p-5 space-y-6 overflow-y-auto flex-1">
                        <section className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">身份信息</h3>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">题号 (Question ID)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={activeConfig.questionNo || ''}
                                        onChange={e => setActiveConfig({ ...activeConfig, questionNo: e.target.value })}
                                        placeholder="如: 15"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">题目名称 / 别名</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={activeConfig.alias || ''}
                                        onChange={e => setActiveConfig({ ...activeConfig, alias: e.target.value })}
                                        placeholder="如: 资产阶级革命综合题"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">所属考试汇总</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        value={activeConfig.examId || ''}
                                        onChange={e => setActiveConfig({ ...activeConfig, examId: e.target.value || null })}
                                    >
                                        <option value="">未关联考试 (离散题目)</option>
                                        {exams.map(exam => (
                                            <option key={exam.id} value={exam.id}>
                                                {exam.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1.5 px-1">关联考试后，该题目将出现在对应的考试文件夹中。</p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">阅卷偏好 (生成参考)</h3>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><Sparkles className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">自动评分策略</p>
                                            <p className="text-[10px] text-slate-400">设置 AI 识别时的默认宽松度</p>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">推荐</div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* --- VIEW 3: EDITOR (Form) --- */}
                <div className={`absolute inset-0 top-6 flex flex-col bg-slate-50 transition-transform duration-300 ${currentView === 'point_editor' ? 'translate-x-0' : 'translate-x-full'}`}>
                    <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-white">
                        <button className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg" onClick={popView}><ArrowLeft className="w-5 h-5" /></button>
                        <h2 className="font-bold text-slate-800 text-sm">编辑行</h2>
                        <button onClick={handleSavePoint} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg shadow-sm">完成</button>
                    </header>
                    {editingPoint && (
                        <div className="p-5 space-y-5 overflow-y-auto flex-1">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">题号 / 标识符</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingPoint.id}
                                        onChange={e => setEditingPoint({ ...editingPoint, id: e.target.value })}
                                        placeholder="例如：15-1-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">问题词 (Question Word)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingPoint.questionSegment || ''}
                                        onChange={e => setEditingPoint({ ...editingPoint, questionSegment: e.target.value })}
                                        placeholder="例如：根本原因"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">分值</label>
                                    <div className="flex gap-3 items-center">
                                        <button onClick={() => setEditingPoint({ ...editingPoint, score: Math.max(0, editingPoint.score - 0.5) })} className="p-2 border rounded-lg hover:bg-slate-50"><Minus className="w-4 h-4 text-slate-400" /></button>
                                        <span className="text-xl font-bold text-indigo-600 w-12 text-center">{editingPoint.score}</span>
                                        <button onClick={() => setEditingPoint({ ...editingPoint, score: editingPoint.score + 0.5 })} className="p-2 border rounded-lg hover:bg-slate-50"><Plus className="w-4 h-4 text-slate-400" /></button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">参考答案 (内容描述)</label>
                                    <textarea
                                        className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                        value={editingPoint.content}
                                        onChange={e => setEditingPoint({ ...editingPoint, content: e.target.value })}
                                        placeholder="例如：根本原因：斯图亚特王朝的封建专制..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">扣分/注意事项 (可选)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-amber-700 bg-amber-50/30"
                                        value={editingPoint.deductionRules || ''}
                                        onChange={e => setEditingPoint({ ...editingPoint, deductionRules: e.target.value })}
                                        placeholder="例如：必须提到...否则不得分"
                                    />
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <label className="block text-xs font-bold text-slate-700 mb-2">匹配关键词</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {editingPoint.keywords.map(kw => (
                                        <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                            {kw}
                                            <button onClick={() => removeKeyword(kw)} className="text-indigo-300 hover:text-indigo-600"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        placeholder="输入关键词..."
                                        value={newKeyword}
                                        onChange={e => setNewKeyword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                                    />
                                    <button onClick={handleAddKeyword} className="px-3 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs hover:bg-slate-200">添加</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {isGenerating && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                        <h3 className="font-bold text-slate-800">正在解析内容...</h3>
                        <p className="text-xs text-slate-500 mt-2">AI 正在进行结构化分析</p>
                    </div>
                )}

                {/* --- Text Import Overlay --- */}
                {showTextImport && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setShowTextImport(false)}>
                        <div className="bg-white w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]" onClick={e => e.stopPropagation()}>
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800">粘贴参考答案文本</h3>
                                <button className="p-1 text-slate-400 hover:text-slate-600" onClick={() => setShowTextImport(false)}><X className="w-4 h-4" /></button>
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    提示：直接粘贴带标签的文本（如“根本原因：...”)，效果比图片识别更精准。
                                </p>
                                <textarea
                                    className="w-full h-48 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50"
                                    placeholder="示例：&#10;(1)根本原因:斯图亚特王朝统治阻碍...&#10;事件:1640年议会重新召开..."
                                    value={rubricTextInput}
                                    onChange={e => setRubricTextInput(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button className="flex-1 px-4 py-2 border border-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50" onClick={() => setShowTextImport(false)}>取消</button>
                                    <button
                                        className="flex-[2] px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                        onClick={handleTextImport}
                                    >
                                        开始智能解析
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}