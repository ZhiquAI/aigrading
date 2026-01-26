import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Tab } from '@/types';
import {
    Settings2,
    History,
    PieChart,
    CheckCircle2,
    Download,
    Share2,
    MonitorCheck,
    MousePointerClick,
    Sparkles,
    ChevronDown,
    Zap
} from 'lucide-react';
import GradingViewV2 from '../views/GradingViewV2';
import RecordsViewV2 from '../views/RecordsViewV2';
import AnalysisViewV2 from '../views/AnalysisViewV2';
import SettingsViewV2 from '../views/SettingsViewV2';
import ExamsViewV2 from '../views/ExamsViewV2';
import { toast } from '@/components/Toast';
import ActivationModal from '@/components/ActivationModal';
import SuccessCelebration from '@/src/components/v2/SuccessCelebration';

// Shell Component
export default function ModernLayout() {
    const {
        activeTab,
        setActiveTab,
        gradingMode,
        setGradingMode,
        setShowV2,
        appMode,
        setAppMode,
        headerActions,
        tasks,
        addTask,
        removeTask,
        status,
        quota
    } = useAppStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [isActivationOpen, setIsActivationOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);

    // Connection Monitoring
    useEffect(() => {
        const handleOnline = () => removeTask('system-offline');
        const handleOffline = () => addTask({
            id: 'system-offline',
            label: '网络连接已断开',
            percent: 100,
            status: 'error',
            message: '处于离线模式，自动同步已暂停'
        });

        if (!navigator.onLine) handleOffline();

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [addTask, removeTask]);

    // Responsive Width Tracking
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const isNarrow = width < 340;
    const isUltraNarrow = width < 280;

    // Dynamic Title Logic
    const getPageTitle = () => {
        switch (activeTab) {
            case Tab.Grading: return '智能阅卷';
            case Tab.Exams: return '考试管理';
            case Tab.History: return '阅卷记录';
            case Tab.Analysis: return '考情分析';
            case Tab.Settings: return '系统设置';
            default: return 'AI Grading';
        }
    };

    /**
     * Header Actions
     * Returns contextual actions for the top-right slot
     */
    const renderHeaderActions = () => {
        // Special case for Grading Tab (Mode Switcher)
        if (activeTab === Tab.Grading) {
            return (
                <div className={`relative flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 items-center ${isNarrow ? 'w-20' : 'w-32'} h-8.5 overflow-hidden`}>
                    {/* Sliding Background */}
                    <div
                        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-[9px] transition-all duration-300 ease-out shadow-sm border ${gradingMode === 'assist'
                            ? 'left-0.5 bg-white border-slate-100'
                            : 'left-[calc(50%+1px)] bg-indigo-600 border-indigo-500'
                            }`}
                    />

                    <button
                        onClick={() => setGradingMode('assist')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-1 h-full transition-colors duration-300 ${gradingMode === 'assist' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-500'
                            }`}
                    >
                        <MousePointerClick size={14} className={gradingMode === 'assist' ? 'animate-pulse' : ''} />
                        {!isNarrow && <span className="text-[11px] font-bold tracking-tight">辅助</span>}
                    </button>

                    <button
                        onClick={() => setGradingMode('auto')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-1 h-full transition-colors duration-300 ${gradingMode === 'auto' ? 'text-white' : 'text-slate-400 hover:text-slate-500'
                            }`}
                    >
                        <Sparkles size={14} className={gradingMode === 'auto' ? 'animate-pulse' : ''} />
                        {!isNarrow && <span className="text-[11px] font-bold tracking-tight">自动</span>}
                    </button>

                    {/* Thinking Glow for Switcher */}
                    {status === 'thinking' && (
                        <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none"></div>
                    )}
                </div>
            );
        }

        // Settings tab has its own switch
        if (activeTab === Tab.Settings) {
            return (
                <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50">
                    <button
                        onClick={() => setAppMode('enterprise')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${appMode === 'enterprise'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {isNarrow ? '企' : '企业版'}
                    </button>
                    <button
                        onClick={() => setAppMode('personal')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${appMode === 'personal'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {isNarrow ? '个' : '个人版'}
                    </button>
                </div>
            );
        }

        // Generic Registered Actions (History, Analysis, etc.)
        return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {headerActions.map((action) => {
                    const hasDropdown = action.dropdown && action.dropdown.length > 0;
                    const isOpen = openDropdownId === action.id;

                    return (
                        <div key={action.id} className="relative">
                            <button
                                onClick={(e) => {
                                    if (hasDropdown) {
                                        setOpenDropdownId(isOpen ? null : action.id);
                                    } else if (action.onClick) {
                                        action.onClick();
                                    }
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${isOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                {action.icon === 'Download' && <Download size={16} />}
                                {!isNarrow && <span>{action.label}</span>}
                                {hasDropdown && <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
                            </button>

                            {isOpen && hasDropdown && (
                                <>
                                    <div className="fixed inset-0 z-[19]" onClick={() => setOpenDropdownId(null)} />
                                    <div className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-100 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-t-4 border-t-indigo-500">
                                        {action.dropdown!.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    item.onClick();
                                                    setOpenDropdownId(null);
                                                }}
                                                className="w-full px-4 py-3 text-xs text-left text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 font-bold transition-colors"
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div ref={containerRef} className="flex flex-col h-screen w-screen bg-white relative font-sans text-slate-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900" onClick={() => setOpenDropdownId(null)}>
            {/* Background Atmosphere Glow */}
            <div
                className={`absolute top-0 left-0 w-full h-1/2 transition-all duration-1000 pointer-events-none opacity-[0.02] ${gradingMode === 'assist' ? 'bg-indigo-600' : 'bg-emerald-600'
                    } blur-[120px] rounded-b-full`}
            />

            {/* Thinking Atmosphere Overlay */}
            {status === 'thinking' && (
                <div className="absolute inset-0 bg-indigo-500/5 animate-pulse pointer-events-none z-[40]"></div>
            )}

            {/* 1. Dynamic Header (V13 Prototype style) */}
            <header className={`bg-white/80 backdrop-blur-xl border-b px-3 flex items-center justify-between shrink-0 sticky top-0 z-20 h-14 transition-all duration-700 ${status === 'thinking' ? 'border-indigo-400 bg-indigo-50/50 shadow-[0_0_20px_rgba(79,70,229,0.1)]' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2 shrink-0">
                    {!isUltraNarrow && <h1 className="font-black text-slate-900 text-base tracking-tight whitespace-nowrap">{getPageTitle()}</h1>}
                    {activeTab === Tab.Grading && (
                        <MembershipBadge
                            isPaid={quota.isPaid}
                            quota={quota}
                            status={status}
                            onClick={() => setIsActivationOpen(true)}
                        />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {renderHeaderActions()}
                </div>
            </header>

            {/* Dynamic Task Tray (Handling multiple tasks) */}
            {tasks.length > 0 && (
                <div className="shrink-0 max-h-32 overflow-y-auto border-b border-slate-100 bg-slate-50/50 backdrop-blur-md z-20 transition-all duration-300">
                    {tasks.map((task) => (
                        <div key={task.id} className="px-4 py-2.5 border-b border-slate-100 last:border-none animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${task.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
                                    {task.status === 'active' && <Sparkles size={10} className="text-indigo-500 animate-pulse" />}
                                    {task.label}
                                </span>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[32px] text-center ${task.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {Math.round(task.percent)}%
                                </span>
                            </div>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ease-out ${task.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'} ${task.status === 'active' ? 'animate-pulse' : ''}`}
                                    style={{ width: `${task.percent}%` }}
                                />
                            </div>
                            {task.message && (
                                <p className={`text-[9px] mt-1 font-bold ${task.status === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                                    {task.message}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 2. Main Content Stage */}
            <main className="flex-1 overflow-hidden relative z-10 pb-16 bg-slate-50/30">

                {/* Tab: Grade (Active View) */}
                <div className={`page-container ${activeTab === Tab.Grading ? 'flex' : 'hidden'} h-full flex-col`}>
                    <GradingViewV2 />
                </div>

                {/* Tab: Exams */}
                <div className={`page-container ${activeTab === Tab.Exams ? 'flex' : 'hidden'} h-full flex-col`}>
                    <ExamsViewV2 />
                </div>

                {/* Tab: History */}
                <div className={`page-container ${activeTab === Tab.History ? 'flex' : 'hidden'} h-full flex-col`}>
                    <RecordsViewV2 />
                </div>

                {/* Tab: Analysis */}
                <div className={`page-container ${activeTab === Tab.Analysis ? 'flex' : 'hidden'} h-full flex-col`}>
                    <AnalysisViewV2 />
                </div>

                {/* Tab: Settings */}
                <div className={`page-container ${activeTab === Tab.Settings ? 'flex' : 'hidden'} h-full flex-col bg-white overflow-y-auto`}>
                    <SettingsViewV2 />
                </div>

            </main>

            {/* 3. Bottom Navigation Bar (V13 Implementation) */}
            <nav className="bg-white/95 backdrop-blur-md border-t border-slate-100 h-16 px-1 flex items-center justify-around shrink-0 fixed bottom-0 w-full z-30 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.05)]">
                <NavButton
                    active={activeTab === Tab.Grading}
                    onClick={() => setActiveTab(Tab.Grading)}
                    icon={<CheckCircle2 size={22} strokeWidth={activeTab === Tab.Grading ? 2.5 : 2} />}
                    label="阅卷"
                    hideLabel={isNarrow}
                />
                <NavButton
                    active={activeTab === Tab.Exams}
                    onClick={() => setActiveTab(Tab.Exams)}
                    icon={<MonitorCheck size={22} strokeWidth={activeTab === Tab.Exams ? 2.5 : 2} />}
                    label="考试"
                    hideLabel={isNarrow}
                />
                <NavButton
                    active={activeTab === Tab.History}
                    onClick={() => setActiveTab(Tab.History)}
                    icon={<History size={22} strokeWidth={activeTab === Tab.History ? 2.5 : 2} />}
                    label="记录"
                    hideLabel={isNarrow}
                />
                <NavButton
                    active={activeTab === Tab.Analysis}
                    onClick={() => setActiveTab(Tab.Analysis)}
                    icon={<PieChart size={22} strokeWidth={activeTab === Tab.Analysis ? 2.5 : 2} />}
                    label="分析"
                    hideLabel={isNarrow}
                />
                <NavButton
                    active={activeTab === Tab.Settings}
                    onClick={() => setActiveTab(Tab.Settings)}
                    icon={<Settings2 size={22} strokeWidth={activeTab === Tab.Settings ? 2.5 : 2} />}
                    label="设置"
                    hideLabel={isNarrow}
                />
            </nav>

            {showCelebration && (
                <SuccessCelebration
                    onComplete={() => setShowCelebration(false)}
                />
            )}

            {isActivationOpen && (
                <ActivationModal
                    onClose={() => setIsActivationOpen(false)}
                    onSuccess={() => {
                        setIsActivationOpen(false);
                        setShowCelebration(true);
                    }}
                />
            )}
        </div>
    );
}

// Helper Component for Nav Button
function NavButton({ active, onClick, icon, label, hideLabel }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, hideLabel?: boolean }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300 relative ${active ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
        >
            {active && (
                <div className="absolute -top-3 w-1 h-1 bg-indigo-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.8)]"></div>
            )}
            <div className={`transition-transform duration-300 ${active ? '-translate-y-0.5' : ''}`}>
                {icon}
            </div>
            {!hideLabel && <span className={`text-[10px] font-black transition-all ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>}
        </button>
    );
}

// Membership Badge Sub-Component
function MembershipBadge({ isPaid, quota, status, onClick }: {
    isPaid: boolean,
    quota: any,
    status: string,
    onClick: () => void
}) {
    if (isPaid) {
        return (
            <div className="relative group overflow-hidden px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200 border border-indigo-400/30 flex items-center gap-1 animate-shimmer-fast cursor-default">
                <Sparkles size={8} className="fill-white text-white" />
                <span className="text-white text-[9px] font-black tracking-widest uppercase">Member</span>
            </div>
        );
    }

    // Trial Mode - Dynamic Quota Logic
    const showQuota = status !== 'idle';

    return (
        <div
            onClick={onClick}
            className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-black tracking-widest shadow-lg shadow-amber-200 flex items-center gap-1 animate-pulse cursor-pointer hover:bg-amber-400 active:scale-95 transition-all"
        >
            <Zap size={8} className="fill-white" />
            <span className="animate-in fade-in duration-500" key={showQuota ? 'quota' : 'trial'}>
                {showQuota ? `${quota.remaining}/${quota.total}` : '试用'}
            </span>
        </div>
    );
}

<style dangerouslySetInnerHTML={{
    __html: `
    @keyframes shimmer-fast {
        0% { transform: translateX(-200%); }
        100% { transform: translateX(200%); }
    }
    .animate-shimmer-fast {
        position: relative;
        overflow: hidden;
    }
    .animate-shimmer-fast::after {
        content: "";
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        animation: shimmer-fast 2s infinite linear;
    }
` }} />