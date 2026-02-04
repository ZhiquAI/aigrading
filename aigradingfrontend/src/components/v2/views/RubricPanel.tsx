import React, { useState, useMemo, useCallback } from 'react';
import {
    Zap, ChevronDown, Folder, BookOpen, Hash,
    Image as ImageIcon, FileText, X, Loader2, Check,
    Clipboard, ArrowLeft
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { generateRubricFromImages, generateRubricFromText } from '@/services/rubric-service';
import { toast } from '@/components/Toast';
import RubricResultView from './RubricResultView';
import RubricListView, { RubricEmptyState } from './RubricListView';

interface RubricPanelProps {
    onClose?: () => void;
}

type ViewState = 'list' | 'input' | 'generating' | 'result';

export default function RubricPanel({ onClose }: RubricPanelProps) {
    const {
        exams,
        rubricLibrary,
        rubricData,
        activeExamId,
        setActiveExamId,
        currentQuestionKey,
        setRubricConfig,
        saveRubric,
        createExamAction,
        selectQuestion,
    } = useAppStore();

    // 判断是否有细则
    const hasRubrics = (rubricLibrary || []).length > 0;

    // 视图状态：有细则默认显示列表，无细则显示创建
    const [viewState, setViewState] = useState<ViewState>(hasRubrics ? 'list' : 'input');
    const [generatedRubric, setGeneratedRubric] = useState<any>(null);

    // 输入状态
    const [showNewExamInput, setShowNewExamInput] = useState(false);
    const [newExamName, setNewExamName] = useState('');
    const [questionNo, setQuestionNo] = useState('');
    const [subject, setSubject] = useState('历史');

    // 图片上传状态
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');

    // 当前选中的考试
    const selectedExam = useMemo(() =>
        exams.find(e => e.id === activeExamId),
        [exams, activeExamId]
    );

    // 进入创建模式
    const handleCreateNew = () => {
        setViewState('input');
        // 重置输入
        setQuestionNo('');
        setQuestionImage(null);
        setAnswerImage(null);
        setTextInput('');
    };

    // 选择已有细则进行查看/编辑
    const handleSelectRubric = (questionKey: string) => {
        selectQuestion(questionKey);
        // TODO: 可以跳转到编辑视图
        toast.info(`已选中: ${questionKey}`);
    };

    // 返回列表
    const handleBackToList = () => {
        if (hasRubrics) {
            setViewState('list');
        } else {
            setViewState('input');
        }
    };

    // 创建考试
    const handleCreateExam = async () => {
        if (!newExamName.trim()) return;
        try {
            const newExam = await createExamAction({
                name: newExamName,
                grade: '初三',
                subject: subject,
                date: new Date().toISOString().split('T')[0]
            });
            setNewExamName('');
            setShowNewExamInput(false);
            if (newExam?.id) {
                setActiveExamId(newExam.id);
            }
            toast.success("考试已创建");
        } catch (e) {
            console.error('[RubricPanel] Create exam error:', e);
            toast.error("创建失败");
        }
    };

    // 图片上传处理
    const handleImageUpload = (type: 'question' | 'answer') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                if (type === 'question') {
                    setQuestionImage(ev.target.result as string);
                } else {
                    setAnswerImage(ev.target.result as string);
                }
                toast.success("图片已上传");
            }
        };
        reader.readAsDataURL(file);
    };

    // AI 生成
    const handleGenerate = async () => {
        if (!textInput.trim() && !answerImage) {
            toast.error("请先导入参考答案");
            return;
        }

        if (!questionNo) {
            toast.error("请输入题号");
            return;
        }

        setViewState('generating');

        try {
            let rubric;
            if (answerImage) {
                rubric = await generateRubricFromImages(questionImage, answerImage, questionNo);
            } else {
                rubric = await generateRubricFromText(textInput, questionNo);
            }

            // 补充元数据
            rubric.examName = selectedExam?.name || '';
            rubric.subject = subject;
            rubric.questionNo = questionNo;

            setGeneratedRubric(rubric);
            setViewState('result');
        } catch (e: any) {
            console.error('AI Generation failed:', e);
            toast.error(`生成失败: ${e.message || '服务不可用'}`);
            setViewState('input');
        }
    };

    // 保存生成的细则
    const handleSaveRubric = async (rubric: any) => {
        const questionKey = currentQuestionKey || `manual:${questionNo}`;
        const fullConfig = {
            questionNo: rubric.questionId || questionNo,
            alias: rubric.title || `第${questionNo}题`,
            subject: subject.toLowerCase(),
            type: 'short_answer',
            anchorKeywords: rubric.answerPoints.flatMap((p: any) => p.keywords || []).slice(0, 5),
            points: rubric.answerPoints.map((p: any) => ({
                id: p.id,
                questionSegment: p.questionSegment,
                content: p.content,
                keywords: p.keywords,
                score: p.score,
                deductionRules: p.deductionRules
            })),
            examId: activeExamId,
            globalPreferences: { handwritingScore: true, spellingStrictness: 'low' }
        };

        setRubricConfig(questionKey, fullConfig as any);
        await saveRubric(JSON.stringify(fullConfig, null, 2), questionKey);

        toast.success("评分细则已保存！");

        // 保存后返回列表
        setViewState('list');
        setGeneratedRubric(null);
        setQuestionNo('');
        setQuestionImage(null);
        setAnswerImage(null);
        setTextInput('');
    };

    // 重新生成
    const handleRegenerate = () => {
        setViewState('input');
        setGeneratedRubric(null);
    };

    const SUBJECTS = ['历史', '政治', '语文', '物理'];

    // ========== 列表视图 ==========
    if (viewState === 'list') {
        return (
            <RubricListView
                onCreateNew={handleCreateNew}
                onSelectRubric={handleSelectRubric}
            />
        );
    }

    // ========== 空状态（无细则时的默认视图）==========
    // 这个逻辑已经在初始状态时处理，如果 hasRubrics 为 false，viewState 就是 'input'

    // ========== 生成中状态 ==========
    if (viewState === 'generating') {
        return (
            <div className="flex flex-col h-full bg-white">
                <header className="h-11 flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-white animate-pulse" />
                        </div>
                        <h1 className="font-bold text-slate-800 text-sm">AI 正在分析...</h1>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-medium">约 5-10 秒</span>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="w-8 h-8 text-indigo-500" />
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-sm font-medium text-slate-800">正在提取得分点...</p>
                        <p className="text-xs text-slate-400 mt-1">Gemini 2.0 Flash 分析中</p>
                    </div>

                    <div className="w-full max-w-[200px]">
                        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========== 结果预览状态 ==========
    if (viewState === 'result' && generatedRubric) {
        return (
            <RubricResultView
                rubric={generatedRubric}
                examName={selectedExam?.name || ''}
                subject={subject}
                questionNo={questionNo}
                onSave={handleSaveRubric}
                onRegenerate={handleRegenerate}
            />
        );
    }

    // ========== 输入状态（创建新细则）==========
    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="h-11 flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div className="flex items-center gap-2">
                    {hasRubrics && (
                        <button
                            onClick={handleBackToList}
                            className="p-1 text-slate-500 hover:text-slate-700 -ml-1"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h1 className="font-bold text-slate-800 text-sm">AI 智能生成细则</h1>
                </div>
            </header>

            {/* 主内容区 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">

                {/* 第一行：考试 + 学科 + 题号 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">基本信息</span>
                        <button className="text-[10px] text-indigo-500 hover:underline">管理考试 →</button>
                    </div>
                    <div className="flex gap-2">
                        {/* 考试选择 */}
                        <div className="flex-[2] relative">
                            <select
                                value={activeExamId || ''}
                                onChange={(e) => {
                                    if (e.target.value === 'new') {
                                        setShowNewExamInput(true);
                                    } else {
                                        setActiveExamId(e.target.value);
                                        setShowNewExamInput(false);
                                    }
                                }}
                                className="w-full pl-8 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium appearance-none focus:border-indigo-300 outline-none truncate"
                            >
                                <option value="">选择考试...</option>
                                {exams.map(exam => (
                                    <option key={exam.id} value={exam.id}>{exam.name}</option>
                                ))}
                                <option value="new">➕ 新建考试</option>
                            </select>
                            <Folder className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* 学科选择 */}
                        <div className="flex-1 relative">
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full pl-7 pr-5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-700 appearance-none focus:border-amber-400 outline-none"
                            >
                                {SUBJECTS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <BookOpen className="w-3.5 h-3.5 text-amber-500 absolute left-2 top-1/2 -translate-y-1/2" />
                            <ChevronDown className="w-3 h-3 text-amber-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* 题号输入 */}
                        <div className="w-16 relative">
                            <input
                                type="text"
                                placeholder="题号"
                                value={questionNo}
                                onChange={e => setQuestionNo(e.target.value)}
                                className="w-full pl-7 pr-2 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-center text-indigo-700 focus:border-indigo-400 outline-none"
                            />
                            <Hash className="w-3.5 h-3.5 text-indigo-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                    </div>

                    {/* 新建考试输入框 */}
                    {showNewExamInput && (
                        <div className="mt-2 flex gap-2">
                            <input
                                type="text"
                                placeholder="输入考试名称，如：期末考试"
                                className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:border-indigo-400 outline-none"
                                value={newExamName}
                                onChange={e => setNewExamName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateExam()}
                                autoFocus
                            />
                            <button
                                onClick={handleCreateExam}
                                className="px-3 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 shrink-0"
                            >
                                创建
                            </button>
                        </div>
                    )}
                </div>

                {/* 第二行：题目图片 + 答案图片 并列 */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-0.5">上传图片</span>
                    <div className="flex gap-3">
                        {/* 题目图片 */}
                        {questionImage ? (
                            <div className="flex-1 relative rounded-xl border border-indigo-200 overflow-hidden min-h-[120px]">
                                <img src={questionImage} className="w-full h-full object-cover" alt="题目" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                    <span className="text-[10px] text-white font-medium">题目图片</span>
                                    <button
                                        onClick={() => setQuestionImage(null)}
                                        className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-slate-600 hover:bg-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        ) : (
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-xl border-2 border-dashed border-slate-200 cursor-pointer min-h-[120px] hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-slate-600">题目图片</p>
                                    <p className="text-[10px] text-slate-400">可选</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('question')} />
                            </label>
                        )}

                        {/* 答案图片 */}
                        {answerImage ? (
                            <div className="flex-1 relative rounded-xl border border-violet-200 overflow-hidden min-h-[120px]">
                                <img src={answerImage} className="w-full h-full object-cover" alt="答案" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                    <span className="text-[10px] text-white font-medium">答案图片</span>
                                    <button
                                        onClick={() => setAnswerImage(null)}
                                        className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-slate-600 hover:bg-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        ) : (
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-xl border-2 border-dashed border-slate-200 cursor-pointer min-h-[120px] hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-violet-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-slate-600">答案图片</p>
                                    <p className="text-[10px] text-violet-500 font-medium">推荐</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('answer')} />
                            </label>
                        )}
                    </div>
                </div>

                {/* 或者分隔线 */}
                <div className="flex items-center gap-3 px-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] text-slate-400 font-medium">或者</span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* 文本输入区 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">粘贴参考答案</span>
                        <button className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                            <Clipboard className="w-3.5 h-3.5" />
                            粘贴
                        </button>
                    </div>
                    <textarea
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        placeholder={`粘贴参考答案文本，例如：\n（1）根本原因：封建专制制度阻碍资本主义发展（2分）\n（2）特点：改革不彻底、保留封建残余（2分）`}
                        className="w-full h-24 p-3 bg-white rounded-xl border border-slate-200 text-xs outline-none resize-none focus:border-indigo-300 placeholder:text-slate-300"
                    />
                </div>
            </div>

            {/* 底部 AI 生成按钮 - 添加安全区域避免被导航栏遮挡 */}
            <div className="p-4 pb-20 bg-white border-t border-slate-100 shrink-0">
                <button
                    onClick={handleGenerate}
                    disabled={(!textInput.trim() && !answerImage) || !questionNo}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 text-white rounded-2xl shadow-lg shadow-indigo-500/30 text-sm font-bold flex items-center justify-center gap-2.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                    </div>
                    <span>AI 一键生成评分细则</span>
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-2">支持 Gemini 2.0 Flash · 预计耗时 5-10 秒</p>
            </div>
        </div>
    );
}
