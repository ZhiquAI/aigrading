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
import { Tab } from '@/types';
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
    const [currentScore, setCurrentScore] = useState(8.5);
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
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'HIGHLIGHT_ANSWER_CARD' });
                    }
                });
            }

            // Small delay for visual flow of "detecting"
            await new Promise(r => setTimeout(r, 1200));
            setIsDetecting(false);
        };
        init();
    }, []);

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

    const startGrading = () => {
        if (!isRubricConfigured) return;
        setStatus('thinking');
        setTimeout(() => {
            setStatus('result');
            setIsInteracting(false); // Reset interaction state for new result
        }, 2000);
    };

    const confirmSubmit = () => {
        // Save to History
        addHistoryRecord({
            questionNo: '15',
            questionKey: currentQuestionKey || '15',
            score: currentScore,
            maxScore: 10,
            comment: '逻辑清晰，对核心概念"经济动因"的阐述非常准确。建议补充更多具体历史案例以增强论证深度。',
            breakdown: [
                { label: '经济动因分析', score: 4, max: 4, comment: '准确提到了资本主义萌芽和商品经济发展的关键点。' },
                { label: '社会阶层变动', score: 2.5, max: 4, comment: '提到了资产阶级兴起，但未涉及封建贵族的衰落。' },
                { label: '卷面表达规范', score: 2, max: 2, comment: '书写极其工整，条理清晰。' }
            ]
        });

        toast.success("评分已提交并同步");
        setStatus('idle');
    };

    const adjustScore = (delta: number) => {
        setIsInteracting(true);
        setCurrentScore(prev => Math.max(0, prev + delta));
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
     * V4 Design Health Check List
     */
    const HealthCheckList = () => {
        const items = [
            {
                label: '答题卡定位',
                status: globalHealth.answerCard === null ? 'pending' : (globalHealth.answerCard ? 'success' : 'error'),
                icon: FileQuestion,
                action: handleRescan
            },
            {
                label: 'API 连接',
                status: globalHealth.api === null ? 'pending' : (globalHealth.api ? 'success' : 'error'),
                icon: Server
            },
            {
                label: '评分细则',
                status: isDetecting && !globalHealth.api ? 'pending' : (isRubricConfigured ? 'success' : 'error'),
                icon: FileCheck2
            }
        ] as const;

        return (
            <div className="w-full max-w-[320px] bg-white rounded-2xl p-2 shadow-sm border border-slate-100 space-y-1 mt-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className={`
                            flex items-center justify-between p-3 rounded-xl transition-all duration-500
                            ${item.status === 'pending' ? 'bg-slate-50/50' : 'bg-slate-50'}
                            ${item.status === 'pending' && idx > 0 && items[idx - 1].status === 'pending' ? 'opacity-50' : 'opacity-100'} 
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm transition-all duration-500
                                ${item.status === 'success'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    : item.status === 'error'
                                        ? 'bg-red-50 border-red-100 text-red-600'
                                        : 'bg-white border-slate-100 text-slate-400'}
                            `}>
                                <item.icon className="w-4 h-4" />
                            </div>
                            <span className={`text-[10px] font-bold transition-colors duration-300 ${item.status !== 'pending' ? 'text-slate-800' : 'text-slate-500'}`}>
                                {item.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {item.label === '答题卡定位' && item.status !== 'pending' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); item.action?.(); }}
                                    className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-indigo-500 transition-colors"
                                    title="重新扫描"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
                                </button>
                            )}
                            <div className="status-icon">
                                {item.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                                {item.status === 'success' && (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center animate-in zoom-in spin-in-90 duration-300">
                                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                    </div>
                                )}
                                {item.status === 'error' && (
                                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center animate-in zoom-in duration-300">
                                        <X className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="relative h-full flex flex-col overflow-hidden">
            {/* PAGE: THINKING (Zen Mode Upgrade) */}
            {status === 'thinking' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700 relative overflow-hidden">
                    {/* Background Light Beam Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-indigo-500/10 via-violet-500/10 to-indigo-500/10 animate-[pulse_4s_infinite]"></div>
                    </div>

                    <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
                        {/* Multiple Pulsing Rings for Zen flow */}
                        <div className="absolute inset-0 border border-indigo-200 rounded-full animate-[ping_3s_infinite] opacity-20"></div>
                        <div className="absolute inset-4 border-2 border-indigo-400 rounded-full animate-[pulse_2s_infinite] opacity-30"></div>
                        <div className="absolute inset-8 border border-violet-300 rounded-full animate-[ping_4s_infinite_reverse] opacity-20"></div>

                        {/* Core AI Orb */}
                        <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-700 rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)] flex items-center justify-center z-10 animate-outline-glow">
                            <Bot className="w-10 h-10 text-white animate-pulse" />
                        </div>

                        {/* Orbital Dots */}
                        <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rounded-full shadow-lg shadow-indigo-300"></div>
                        </div>
                        <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-violet-400 rounded-full shadow-lg shadow-violet-200"></div>
                        </div>
                    </div>

                    <div className="text-center space-y-4 max-w-[280px] z-10">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                            <span>正在思考</span>
                            <span className="flex gap-0.5">
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite]"></span>
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_100ms]"></span>
                                <span className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                            </span>
                        </h3>

                        {/* Dynamic Reasoning Message */}
                        <div className="h-8 overflow-hidden relative">
                            <p
                                key={thinkingStep}
                                className="text-xs font-bold text-indigo-600/70 uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-500"
                            >
                                {thinkingMessages[thinkingStep]}
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <div className="flex -space-x-1.5 items-center">
                                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                </div>
                                <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                                    <Sparkles size={12} className="text-indigo-500" />
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
                                <div className="absolute inset-0 border border-indigo-100 rounded-full scale-150 opacity-60 transition-all duration-700 delay-100"></div>
                                <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-20 animate-[pulse-ring_2s_infinite]"></div>
                            </>
                        )}

                        {/* Core */}
                        <div className={`
                            w-24 h-24 rounded-full shadow-lg flex items-center justify-center relative z-10 transition-all duration-700
                            ${!isRubricConfigured || isDetecting
                                ? 'bg-slate-300 grayscale opacity-80 scale-90'
                                : 'bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-indigo-500/30 group-hover:scale-105 active:scale-95 animate-[float_6s_infinite_ease-in-out]'
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
                        <p className={`text-xs font-medium mt-1 transition-colors duration-500 ${!isRubricConfigured || isDetecting ? 'text-slate-400' : 'text-indigo-500'}`}>
                            {isDetecting ? '正在连接阅卷环境' : isRubricConfigured ? '点击上方光球开始阅卷' : '配置后即可体验 AI 智能阅卷'}
                        </p>
                    </div>

                    {/* V4 Health Check List */}
                    <HealthCheckList />

                    {/* Rubric Config Button (If check failed) */}
                    {!isDetecting && !isRubricConfigured && globalHealth.api && (
                        <button
                            onClick={() => setIsRubricDrawerOpen(true)}
                            className="mt-4 px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
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
                        className="px-8 py-3 rounded-xl font-bold shadow-xl shadow-indigo-200 active:scale-95 transition-all"
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
                            relative overflow-hidden mb-6 group rounded-3xl p-6 text-white transition-all duration-500
                            ${quota.remaining < 10 && quota.remaining > 0 ? 'bg-amber-900 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-slate-900 shadow-2xl'}
                        `}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-30"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500 rounded-full blur-[50px] opacity-20"></div>

                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <div className="flex items-baseline gap-1 group-hover:scale-105 transition-transform origin-left">
                                        <span className="text-5xl font-black tracking-tighter">{currentScore}</span>
                                        <span className="text-xl text-slate-500 font-medium">/ 10</span>
                                    </div>
                                </div>
                                <div className="absolute top-2 right-12 md:top-4 md:right-24 z-20 pointer-events-none select-none">
                                    <GradeStamp score={currentScore} maxScore={10} />
                                </div>
                                <div className="relative flex items-center gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <button onClick={() => adjustScore(0.5)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all active:scale-90">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => adjustScore(-0.5)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all active:scale-90">
                                            <Minus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="w-16 h-16 relative flex items-center justify-center ring-4 ring-indigo-500/20 rounded-full backdrop-blur-sm">
                                        <svg className="w-full h-full transform -rotate-90 absolute">
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" fill="transparent" className="text-slate-800" />
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" fill="transparent" stroke-dasharray="175" stroke-dashoffset={175 - (currentScore / 10) * 175} className="text-indigo-400" stroke-linecap="round" />
                                        </svg>
                                        <span className="text-[10px] font-black relative">{Math.round(currentScore * 10)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/10">
                                <p className="text-xs text-slate-300 leading-relaxed italic">
                                    <span className="text-indigo-300 font-bold not-italic mr-1">AI 点评:</span>
                                    逻辑清晰，对核心概念"经济动因"的阐述非常准确。建议补充更多具体历史案例以增强论证深度。
                                </p>
                            </div>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">评分维度解析</div>
                            {[
                                { title: '经济动因分析', score: 4, full: 4, comment: '准确提到了资本主义萌芽和商品经济发展的关键点。' },
                                { title: '社会阶层变动', score: 2.5, full: 4, comment: '提到了资产阶级兴起，但未涉及封建贵族的衰落。' },
                                { title: '卷面表达规范', score: 2, full: 2, comment: '书写极其工整，条理清晰。' }
                            ].map((item, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:border-indigo-200 hover:bg-white shadow-sm hover:shadow-md">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${item.score === item.full ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                            <span className="text-xs font-bold text-slate-700">{item.title}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.score === item.full ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {item.score} / {item.full}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed">{item.comment}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Milestone Card Overlay */}
                    {quota.status === 'expired' && (
                        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-end justify-center animate-in fade-in duration-500">
                            <div className="w-full bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-700">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 rotate-12 shadow-xl shadow-indigo-100 border border-indigo-100 relative">
                                        <Trophy size={40} className="text-indigo-600 -rotate-12" />
                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-xs border-2 border-white shadow-lg">10</div>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 mb-2">太棒了！</h2>
                                    <p className="text-slate-500 text-sm mb-8 max-w-[280px] leading-relaxed">
                                        您今天已助力 <span className="text-indigo-600 font-black">10</span> 位同学。
                                        节省重复机械工作约 <span className="text-indigo-600 font-black">30 分钟</span> ⌛
                                    </p>
                                    <div className="w-full space-y-3">
                                        <Button variant="gradient" fullWidth className="py-4 rounded-2xl text-base font-black tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all" onClick={() => setIsActivationOpen(true)}>
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
                        <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-2 flex items-center gap-2 shadow-2xl shadow-indigo-500/20 border border-white/5">
                            <button onClick={() => setStatus('idle')} className="p-3 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="放弃本次批改">
                                <RotateCcw className="w-5 h-5" />
                            </button>
                            <div className="w-[1px] h-6 bg-white/10"></div>
                            <button onClick={confirmSubmit} className={`flex-1 font-bold py-3 px-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg ${gradingMode === 'auto' && !isIntervening ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white text-slate-900 hover:bg-slate-100'}`}>
                                <span className="text-sm">{isIntervening ? '确认修改并下一份' : (gradingMode === 'auto' && autoCountdown !== null ? `自动提交中 (${autoCountdown}s)` : '确认并下一份')}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
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
                @keyframes glow { 0% { box-shadow: 0 0 20px rgba(79, 70, 229, 0.4); } 50% { box-shadow: 0 0 50px rgba(79, 70, 229, 0.7); } 100% { box-shadow: 0 0 20px rgba(79, 70, 229, 0.4); } }
                .animate-outline-glow { animation: glow 3s infinite ease-in-out; }
            `}} />
        </div>
    );
}