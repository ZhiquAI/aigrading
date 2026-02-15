import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Minus,
    Bot,
    ShieldCheck,
    ScanLine,
    Pencil,
    RotateCcw,
    ArrowRight,
    Zap,
    Loader2,
    Check,
    X,
    FileQuestion,
    Server,
    FileCheck2,
    CheckCircle2,
    Trophy,
    MousePointerClick,
    Sparkles,
    RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { Tab, type PageContext, type StudentResult } from '@/types';
import { gradeWithProxy } from '@/services/proxyService';
import { Button } from '@/components/ui';
import { toast } from '@/components/Toast';
import RubricDrawer from './RubricDrawer';
import ActivationModal from '@/components/ActivationModal';
import SuccessCelebration from '@/src/components/v2/SuccessCelebration';

// 印章组件
const GradeStamp: React.FC<{ score: number; maxScore: number }> = ({ score, maxScore }) => {
    const percentage = (score / maxScore) * 100;

    let label = '已阅';
    let colorClass = 'border-red-500/80 text-red-500/80';

    if (percentage >= 90) {
        label = '优秀';
        colorClass = 'border-rose-500 text-rose-500';
    } else if (percentage >= 80) {
        label = '良好';
        colorClass = 'border-orange-400 text-orange-400';
    } else if (percentage < 60) {
        label = '待改进';
        colorClass = 'border-slate-400 text-slate-400';
    } else {
        label = '及格';
        colorClass = 'border-amber-500 text-amber-500';
    }

    return (
        <div className={`
            px-3 py-1 border-2 ${colorClass} rounded-sm font-black text-xs uppercase tracking-tighter rotate-[-15deg] opacity-70 scale-150
            animate-in zoom-in-150 duration-500
        `}>
            {label}
        </div>
    );
};

export default function GradingViewV2() {
    const {
        isRubricConfigured,
        currentQuestionKey,
        setIsRubricDrawerOpen,
        isRubricDrawerOpen,
        rubricContent,
        saveRubric,
        gradingMode,
        setGradingMode,
        addHistoryRecord,
        quota,
        setActiveTab,
        autoGradingInterval,
        status,
        setStatus,
        health: globalHealth,
        setHealth: setGlobalHealth
    } = useAppStore();

    const [isDetecting, setIsDetecting] = useState(true);
    const [currentScore, setCurrentScore] = useState(0);
    const [maxScore, setMaxScore] = useState(10);
    const [gradingResult, setGradingResult] = useState<StudentResult | null>(null);
    const [pageContext, setPageContext] = useState<PageContext | null>(null);
    const [isIntervening, setIsInteracting] = useState(false);

    // Auto Mode Countdown
    const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
    const [countdownStart, setCountdownStart] = useState<number>(0);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    const [isActivationOpen, setIsActivationOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);

    // Real-time Health Listener
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.type === 'REAL_TIME_STATUS') {
                setGlobalHealth({
                    answerCard: message.hasAnswerCard,
                    api: true // Assume API is functional if communication is working
                });
            }
        };

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener(handleMessage);
        }

        return () => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.onMessage.removeListener(handleMessage);
            }
        };
    }, [setGlobalHealth]);

    // Handle Auto Mode Logic when result appears
    useEffect(() => {
        if (status === 'result' && gradingMode === 'auto' && !isIntervening) {
            const initialSeconds = Math.ceil(autoGradingInterval / 1000);
            setAutoCountdown(initialSeconds);
            setCountdownStart(Date.now());

            countdownRef.current = setInterval(() => {
                setAutoCountdown(prev => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        // Time's up
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        confirmSubmit(); // Auto submit
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            // Reset if status changes, mode changes, or user starts intervening
            if (countdownRef.current) clearInterval(countdownRef.current);
            setAutoCountdown(null);
        }

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [status, gradingMode, isIntervening, autoGradingInterval]);

    // Initial Detection Trigger
    useEffect(() => {
        const init = async () => {
            setIsDetecting(true);

            // Request immediate scan
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_PAGE_DATA' }, (response) => {
                            // 检查响应中的评分细则状态
                            if (response?.success && response?.isRubricConfigured === false) {
                                console.log('[GradingViewV2] 检测到评分细则未配置，自动打开设置');
                                // 延迟弹出，给用户视觉过渡
                                setTimeout(() => {
                                    setIsRubricDrawerOpen(true);
                                    toast.info('请先配置评分细则，即可开始阅卷');
                                }, 300);
                            }
                        });
                    }
                });
            }

            // Small delay for visual flow of "detecting"
            await new Promise(r => setTimeout(r, 1200));
            setIsDetecting(false);
        };
        init();
    }, [setIsRubricDrawerOpen]);

    const handleRescan = () => {
        setIsDetecting(true);
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'HIGHLIGHT_ANSWER_CARD' }, (response) => {
                        if (response?.success) {
                            toast.success("已重新定位答题卡");
                        } else {
                            toast.error("未找到答题卡，请检查页面");
                        }
                    });
                }
            });
        }
        setTimeout(() => setIsDetecting(false), 800);
    };

    // --- Actions ---
    const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

    const requestPageContext = (): Promise<PageContext | null> => new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            resolve(null);
            return;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                resolve(null);
                return;
            }
            chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_DATA' }, (response?: { success: boolean; data?: PageContext; error?: string }) => {
                if (chrome.runtime.lastError || !response?.success || !response.data) {
                    resolve(null);
                    return;
                }
                resolve(response.data);
            });
        });
    });

    const startGrading = async () => {
        if (!isRubricConfigured) return;
        if (!rubricContent) {
            toast.error('未检测到评分细则内容');
            return;
        }

        setStatus('thinking');
        setIsInteracting(false);
        setGradingResult(null);

        try {
            const ctx = await requestPageContext();
            if (!ctx?.answerImageBase64) {
                toast.error('未检测到答题卡，请确认页面已加载');
                setStatus('idle');
                return;
            }

            const result = await gradeWithProxy(
                ctx.answerImageBase64,
                rubricContent,
                ctx.studentName,
                ctx.questionNo || undefined,
                'pro',
                { questionKey: ctx.questionKey || undefined, examNo: ctx.examNo }
            );

            setPageContext(ctx);
            setGradingResult(result);
            setCurrentScore(result.score);
            setMaxScore(result.maxScore || 10);

            const reviewRequired = !!result.needsReview
                || (typeof result.confidence === 'number' && result.confidence < REVIEW_CONFIDENCE_THRESHOLD);
            setIsInteracting(reviewRequired);
            setStatus('result');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '阅卷失败';
            console.error('[GradingViewV2] Grading error:', err);
            toast.error(message);
            setStatus('error');
        }
    };

    const confirmSubmit = () => {
        if (!gradingResult) {
            toast.error('暂无可提交的评分结果');
            return;
        }
        // Save to History
        addHistoryRecord({
            questionNo: pageContext?.questionNo || '未识别',
            questionKey: pageContext?.questionKey || currentQuestionKey || 'unknown',
            score: currentScore,
            maxScore: maxScore,
            comment: gradingResult.comment,
            breakdown: gradingResult.breakdown.map((item) => ({
                label: item.label,
                score: item.score,
                max: item.max,
                comment: item.comment
            }))
        });

        toast.success("评分已提交并同步");
        setStatus('idle');
    };

    const adjustScore = (delta: number) => {
        setIsInteracting(true);
        setCurrentScore(prev => {
            const next = prev + delta;
            return Math.min(Math.max(0, next), Math.max(1, maxScore));
        });
    };

    // Thinking Messages Loop
    const [thinkingStep, setThinkingStep] = useState(0);
    const thinkingMessages = [
        "正在语义化提取答卷特征...",
        "正在匹配历史关联阅卷标准...",
        "正在进行逻辑一致性校验...",
        "正在根据批改细则精确评分...",
        "正在生成人性化的教师评语...",
        "正在准备同步至网页打分框..."
    ];

    const scoreRatio = maxScore > 0 ? Math.min(1, currentScore / maxScore) : 0;
    const reviewRequired = !!gradingResult && (
        gradingResult.needsReview
        || (typeof gradingResult.confidence === 'number' && gradingResult.confidence < REVIEW_CONFIDENCE_THRESHOLD)
    );

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'thinking') {
            setThinkingStep(0);
            interval = setInterval(() => {
                setThinkingStep(s => (s + 1) % thinkingMessages.length);
            }, 1200);
        }
        return () => clearInterval(interval);
    }, [status]);

    /**
     * 检测中指示器 - 简洁的加载状态
     */
    const DetectingIndicator = () => (
        <div className="w-full max-w-[320px] bg-white/92 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-[#DFE7F2] mt-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF3FF] border border-[#D8E4F7] flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-[#2F6FFF] animate-spin" />
                </div>
                <div>
                    <p className="text-xs font-bold text-[#2B3E5E]">正在连接阅卷环境</p>
                    <p className="text-[10px] text-[#8A99AE]">检测答题卡与 API 状态...</p>
                </div>
            </div>
        </div>
    );

    /**
     * 系统就绪确认 - 所有检查通过后显示
     */
    const ReadyConfirmation = () => (
        <div className="w-full max-w-[320px] bg-gradient-to-br from-[#EFF8F3] to-white rounded-2xl p-4 shadow-sm border border-[#D6EFE0] mt-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#47A078] flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-700">系统已就绪</p>
                    <p className="text-[10px] text-slate-500 truncate">
                        当前细则: {currentQuestionKey || '默认题目'}
                    </p>
                </div>
                <button
                    onClick={() => setIsRubricDrawerOpen(true)}
                    className="p-2 hover:bg-emerald-100 rounded-lg text-[#3E8F6A] transition-colors"
                    title="查看/修改评分细则"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="relative h-full flex flex-col overflow-hidden">
            {/* PAGE: THINKING (Zen Mode Upgrade) */}
            {status === 'thinking' && (
                <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6 animate-in fade-in duration-700">
                    {/* Background Light Beam Effect */}
                    <div className="absolute top-1/2 left-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-25">
                        <div className="absolute left-0 top-0 h-full w-full animate-[pulse_4s_infinite] bg-gradient-to-tr from-[#DCE8FB]/35 via-[#EAE6F8]/30 to-[#DCE8FB]/35"></div>
                    </div>

                    <div className="relative mb-12 flex h-48 w-48 items-center justify-center">
                        {/* Multiple Pulsing Rings for Zen flow */}
                        <div className="absolute inset-0 rounded-full border border-[#CFDBF2] animate-[ping_3s_infinite] opacity-20"></div>
                        <div className="absolute inset-4 rounded-full border-2 border-[#8BA9E7] animate-[pulse_2s_infinite] opacity-35"></div>
                        <div className="absolute inset-8 rounded-full border border-[#CABBEA] animate-[ping_4s_infinite_reverse] opacity-25"></div>

                        {/* Core AI Orb */}
                        <div className="z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#2F6FFF] to-[#5F92FF] shadow-[0_14px_28px_rgba(47, 111, 255,0.34)] animate-outline-glow">
                            <Bot className="w-10 h-10 text-white animate-pulse" />
                        </div>

                        {/* Orbital Dots */}
                        <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
                            <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#2F6FFF] shadow-lg shadow-[#BED2FF]"></div>
                        </div>
                        <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
                            <div className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#9C90D8] shadow-lg shadow-[#DDD4F2]"></div>
                        </div>
                    </div>

                    <div className="text-center space-y-4 max-w-[280px] z-10">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                            <span>正在思考</span>
                            <span className="flex gap-0.5">
                                <span className="w-1 h-3 bg-[#2F6FFF] rounded-full animate-[bounce_1s_infinite]"></span>
                                <span className="w-1 h-3 bg-[#2F6FFF] rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                                <span className="w-1 h-3 bg-[#2F6FFF] rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                            </span>
                        </h3>

                        {/* Dynamic Reasoning Message */}
                        <div className="h-8 overflow-hidden relative">
                            <p
                                key={thinkingStep}
                                className="text-xs font-bold text-[#2F6FFF]/80 uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-500"
                            >
                                {thinkingMessages[thinkingStep]}
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <div className="flex -space-x-1.5 items-center">
                                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                </div>
                                <div className="w-6 h-6 rounded-full bg-[#EDF3FF] border border-[#D7E3F8] flex items-center justify-center shadow-sm">
                                    <Sparkles size={12} className="text-[#2F6FFF]" />
                                </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">AI 分析进行中</span>
                        </div>
                    </div>
                </div>
            )}

            {/* PAGE: IDLE / SCANNING */}
            {(status === 'idle' || status === 'scanning') && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 mb-10 relative">
                    {/* The Orb */}
                    <div
                        onClick={isRubricConfigured && !isDetecting ? startGrading : undefined}
                        className={`
                            relative w-40 h-40 flex items-center justify-center transition-all duration-700
                            ${!isRubricConfigured || isDetecting ? 'cursor-not-allowed' : 'cursor-pointer group'}
                        `}
                    >
                        {/* Detection Ring */}
                        {isDetecting && (
                            <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-full animate-[spin_10s_linear_infinite]"></div>
                        )}

                        {/* Ready Rings - Only show when ALL checks passed */}
                        {isRubricConfigured && !isDetecting && (
                            <>
                                <div className="absolute inset-0 border border-slate-200 rounded-full scale-125 opacity-100 transition-all duration-700"></div>
                                <div className="absolute inset-0 border border-[#D7E3F8] rounded-full scale-150 opacity-60 transition-all duration-700 delay-100"></div>
                                <div className="absolute inset-0 rounded-full bg-[#9FBBF8] opacity-20 animate-[pulse-ring_2s_infinite]"></div>
                            </>
                        )}

                        {/* Core */}
                        <div className={`
                            w-24 h-24 rounded-full shadow-lg flex items-center justify-center relative z-10 transition-all duration-700
                            ${!isRubricConfigured || isDetecting
                                ? 'bg-slate-300 grayscale opacity-80 scale-90'
                                : 'bg-gradient-to-br from-[#2F6FFF] to-[#5F92FF] shadow-[0_14px_28px_rgba(47, 111, 255,0.3)] group-hover:scale-105 active:scale-95 animate-[float_6s_infinite_ease-in-out]'
                            }
                        `}>
                            {isDetecting ? (
                                <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
                            ) : (
                                <Zap className="w-10 h-10 text-white" />
                            )}
                        </div>
                    </div>

                    {/* Status Title */}
                    <div className="text-center mt-4 h-12">
                        <h2 className={`text-xl font-black transition-colors duration-500 ${!isRubricConfigured || isDetecting ? 'text-slate-400' : 'text-slate-800'}`}>
                            {isDetecting ? '系统自检中...' : isRubricConfigured ? '准备就绪' : '请完成配置'}
                        </h2>
                        <p className={`text-xs font-medium mt-1 transition-colors duration-500 ${!isRubricConfigured || isDetecting ? 'text-slate-400' : 'text-[#2F6FFF]'}`}>
                            {isDetecting ? '正在连接阅卷环境' : isRubricConfigured ? '点击上方光球开始阅卷' : '配置后即可体验 AI 智能阅卷'}
                        </p>
                    </div>

                    {/* 系统状态指示器 */}
                    {isDetecting && <DetectingIndicator />}
                    {!isDetecting && isRubricConfigured && globalHealth.api && <ReadyConfirmation />}

                    {/* Rubric Config Button (If check failed) */}
                    {!isDetecting && !isRubricConfigured && globalHealth.api && (
                        <button
                            onClick={() => setIsRubricDrawerOpen(true)}
                            className="mt-4 px-6 py-2.5 bg-[#2F6FFF] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#B3C9F3] hover:bg-[#235EEA] transition-all flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            配置评分细则
                        </button>
                    )}
                </div>
            )}

            {/* Trial Lock Overlay */}
            {quota.status === 'expired' && status === 'idle' && (
                <div className="absolute inset-0 z-40 bg-white/40 backdrop-blur-[8px] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 text-slate-400 shadow-inner">
                        <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">试用权限已封存</h3>
                    <p className="text-xs text-slate-500 mb-8 max-w-[240px] leading-relaxed">
                        您的试用能量已全部转化。开启专业版账号，解锁永久云端存储与无限可能。
                    </p>
                    <Button
                        variant="gradient"
                        className="px-8 py-3 rounded-xl font-bold shadow-xl shadow-[#B4C7EA] active:scale-95 transition-all"
                        onClick={() => setIsActivationOpen(true)}
                    >
                        立即开启专业版
                    </Button>
                </div>
            )}

            {/* PAGE: RESULT */}
            {status === 'result' && (
                <div className="flex-1 flex flex-col bg-white animate-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto p-4 pb-32 scrollbar-thin">
                        {/* Auto Mode Timer Toast */}
                        {gradingMode === 'auto' && autoCountdown !== null && (
                            <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 relative overflow-hidden">
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[11px] font-bold text-emerald-700">自动模式：{autoCountdown}s 后提交</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsInteracting(true);
                                            setAutoCountdown(null);
                                        }}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-white px-2 py-1 rounded-lg border border-emerald-100 shadow-sm"
                                    >
                                        取消/调整分数
                                    </button>
                                </div>
                                <div className="h-1 w-full bg-emerald-100/50 rounded-full overflow-hidden relative z-10">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                                        style={{ width: `${(autoCountdown / (autoGradingInterval / 1000)) * 100}%` }}
                                    ></div>
                                </div>
                                <Sparkles className="absolute -bottom-2 -right-2 text-emerald-200 opacity-20 rotate-12" size={48} />
                            </div>
                        )}

                        {reviewRequired && (
                            <div className="mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[11px] text-amber-700">
                                ⚠️ 该结果置信度较低，需要人工复核，自动提交已暂停。
                                {typeof gradingResult?.confidence === 'number' && (
                                    <span className="ml-2 text-[10px] text-amber-500">置信度 {(gradingResult.confidence * 100).toFixed(0)}%</span>
                                )}
                            </div>
                        )}

                        {/* Sync Badge & Mode Switcher Row */}
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className={`
                                px-4 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-sm border transition-colors
                                ${isIntervening ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}
                            `}>
                                {isIntervening ? (
                                    <>
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>修改中... (尚未提交)</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>分数已同步到网页打分框</span>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setGradingMode(gradingMode === 'assist' ? 'auto' : 'assist')}
                                className={`px-4 py-2 rounded-full text-[15px] font-black tracking-widest border transition-all flex items-center gap-2 active:scale-95 shadow-md
                                    ${gradingMode === 'auto' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                            >
                                {gradingMode === 'auto' ? <Sparkles size={14} /> : <MousePointerClick size={14} />}
                                {gradingMode === 'auto' ? 'AUTO' : 'ASSIST'}
                            </button>
                        </div>

                        {/* Score Card */}
                        <div className={`
                            relative overflow-hidden mb-6 group rounded-3xl p-6 text-[#17233B] transition-all duration-500 border
                            ${quota.remaining < 10 && quota.remaining > 0
                                ? 'bg-[#FFF8F2] border-[#F2D9BF] shadow-[0_12px_30px_rgba(201,157,110,0.18)]'
                                : 'bg-[#F8FBFF] border-[#DCE6F3] shadow-[0_12px_30px_rgba(32,52,88,0.10)]'}
                        `}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#BFD4FF] rounded-full blur-[60px] opacity-35"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#D4C9F2] rounded-full blur-[50px] opacity-28"></div>

                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <div className="flex items-baseline gap-1 group-hover:scale-105 transition-transform origin-left">
                                        <span className="text-5xl font-black tracking-tighter">{currentScore}</span>
                                        <span className="text-xl text-[#7485A0] font-medium">/ {maxScore}</span>
                                    </div>
                                </div>
                                <div className="absolute top-2 right-12 md:top-4 md:right-24 z-20 pointer-events-none select-none">
                                    <GradeStamp score={currentScore} maxScore={maxScore} />
                                </div>
                                <div className="relative flex items-center gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <button onClick={() => adjustScore(0.5)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center border border-[#D8E4F6] text-[#4A79CC] transition-all active:scale-90">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => adjustScore(-0.5)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center border border-[#D8E4F6] text-[#4A79CC] transition-all active:scale-90">
                                            <Minus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="w-16 h-16 relative flex items-center justify-center rounded-full ring-4 ring-[#CFE0FB]/70 bg-white/70 backdrop-blur-sm">
                                        <svg className="w-full h-full transform -rotate-90 absolute">
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" fill="transparent" className="text-[#D8E4F6]" />
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" fill="transparent" stroke-dasharray="175" stroke-dashoffset={175 - scoreRatio * 175} className="text-[#2F6FFF]" stroke-linecap="round" />
                                        </svg>
                                        <span className="text-[10px] font-black relative">{Math.round(scoreRatio * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-[#DFE8F5]">
                                <p className="text-xs text-[#5C6E88] leading-relaxed italic">
                                    <span className="text-[#2F6FFF] font-bold not-italic mr-1">AI 点评:</span>
                                    {gradingResult?.comment || '暂无评语'}
                                </p>
                            </div>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">评分维度解析</div>
                            {(gradingResult?.breakdown || []).length === 0 && (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[10px] text-slate-400">
                                    暂无细分维度
                                </div>
                            )}
                            {(gradingResult?.breakdown || []).map((item, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:border-[#C8D8F5] hover:bg-white shadow-sm hover:shadow-md">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${item.score === item.max ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.score === item.max ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {item.score} / {item.max}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed">{item.comment || '无补充说明'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Milestone Card Overlay */}
                    {quota.status === 'expired' && (
                        <div className="absolute inset-0 z-50 bg-[#EAF0F8]/70 backdrop-blur-md flex items-end justify-center animate-in fade-in duration-500">
                            <div className="w-full bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-700">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-[#EEF3FF] rounded-3xl flex items-center justify-center mb-6 rotate-12 shadow-xl shadow-[#C6D8F7] border border-[#DCE7F8] relative">
                                        <Trophy size={40} className="text-[#2F6FFF] -rotate-12" />
                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-xs border-2 border-white shadow-lg">10</div>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 mb-2">太棒了！</h2>
                                    <p className="text-slate-500 text-sm mb-8 max-w-[280px] leading-relaxed">
                                        您今天已助力 <span className="text-[#2F6FFF] font-black">10</span> 位同学。
                                        节省重复机械工作约 <span className="text-[#2F6FFF] font-black">30 分钟</span> ⌛
                                    </p>
                                    <div className="w-full space-y-3">
                                        <Button variant="gradient" fullWidth className="py-4 rounded-2xl text-base font-black tracking-widest shadow-xl shadow-[#B4C7EA] active:scale-95 transition-all" onClick={() => setIsActivationOpen(true)}>
                                            立即开启专业版
                                        </Button>
                                        <button onClick={() => setStatus('idle')} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors py-2">
                                            先回列表看看
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fixed Action Dock */}
                    <div className={`absolute bottom-4 left-4 right-4 z-30 transition-transform duration-500 ${quota.status === 'expired' ? 'translate-y-24' : ''}`}>
                        <div className="rounded-2xl border border-[#DDE7F4] bg-white/96 p-2 shadow-[0_14px_28px_rgba(23,39,68,0.14)] backdrop-blur-xl">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setStatus('idle')} className="p-3 rounded-xl hover:bg-[#F1F5FB] text-[#7A8AA3] hover:text-[#4A5E7A] transition-colors" title="放弃本次批改">
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                                <div className="h-6 w-[1px] bg-[#E4ECF8]"></div>
                                <button
                                    onClick={confirmSubmit}
                                    className={`flex-1 font-bold py-3 px-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm ${gradingMode === 'auto' && !isIntervening
                                        ? 'bg-[#47A078] text-white hover:bg-[#3A8F69]'
                                        : 'bg-gradient-to-r from-[#2F6FFF] to-[#5F92FF] text-white hover:from-[#235EEA] hover:to-[#5A8DEE]'
                                        }`}
                                >
                                    <span className="text-sm">{isIntervening ? '确认修改并下一份' : (gradingMode === 'auto' && autoCountdown !== null ? `自动提交中 (${autoCountdown}s)` : '确认并下一份')}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <RubricDrawer isOpen={isRubricDrawerOpen} onClose={() => setIsRubricDrawerOpen(false)} />

            {isActivationOpen && (
                <ActivationModal
                    onClose={() => setIsActivationOpen(false)}
                    onSuccess={() => {
                        setIsActivationOpen(false);
                        setShowCelebration(true);
                        import('@/stores/useAppStore').then(m => m.useAppStore.getState().syncQuota());
                    }}
                />
            )}

            {showCelebration && <SuccessCelebration onComplete={() => setShowCelebration(false)} />}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shimmer-fast { 0% { transform: translateX(-200%); } 100% { transform: translateX(200%); } }
                .animate-shimmer-fast { position: relative; overflow: hidden; }
                .animate-shimmer-fast::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer-fast 2s infinite linear; }
                @keyframes glow { 0% { box-shadow: 0 0 14px rgba(47, 111, 255,0.26); } 50% { box-shadow: 0 0 26px rgba(47, 111, 255,0.45); } 100% { box-shadow: 0 0 14px rgba(47, 111, 255,0.26); } }
                .animate-outline-glow { animation: glow 3s infinite ease-in-out; }
            `}} />
        </div>
    );
}
