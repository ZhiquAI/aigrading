import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Tab } from '@/types';
import {
    CheckCircle2,
    FileText,
    History,
    Settings2,
    Sparkles
} from 'lucide-react';
import RubricPanel from '../views/RubricPanel';
import GradingViewV2 from '../views/GradingViewV2';
import RecordsViewV2 from '../views/RecordsViewV2';
import SettingsViewV2 from '../views/SettingsViewV2';

export default function ModernLayout() {
    const {
        activeTab,
        setActiveTab,
        tasks,
        addTask,
        removeTask,
        status
    } = useAppStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

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

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const isNarrow = width < 340;

    const moduleAccent = useMemo(() => {
        switch (activeTab) {
            case Tab.Rubric:
                return { line: 'from-[#2F6FFF] to-[#5F92FF]', blob: 'bg-[#BBD2FF]' };
            case Tab.Grading:
                return { line: 'from-[#5F8AED] to-[#7AA5F5]', blob: 'bg-[#C8DCF7]' };
            case Tab.History:
                return { line: 'from-[#8F9FCC] to-[#B49FCF]', blob: 'bg-[#DCCFED]' };
            case Tab.Settings:
                return { line: 'from-[#95A8C2] to-[#BBC7D8]', blob: 'bg-[#DDE5F0]' };
            default:
                return { line: 'from-[#2F6FFF] to-[#5F92FF]', blob: 'bg-[#BBD2FF]' };
        }
    }, [activeTab]);

    return (
        <div
            ref={containerRef}
            className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#EDF2F3] font-sans text-[#111827] selection:bg-[#DCE7FF] selection:text-[#111827]"
        >
            <div className={`pointer-events-none absolute -top-28 left-1/2 h-[260px] w-[430px] -translate-x-1/2 rounded-full opacity-45 blur-[78px] ${moduleAccent.blob}`} />
            <div className="pointer-events-none absolute -bottom-24 left-1/2 h-[200px] w-[360px] -translate-x-1/2 rounded-full bg-[#DCE7F3] opacity-45 blur-[90px]" />

            {status === 'thinking' && (
                <div className="pointer-events-none absolute inset-0 z-[40] animate-pulse bg-[#2F6FFF]/6" />
            )}

            {tasks.length > 0 && (
                <div className="z-20 max-h-32 shrink-0 overflow-y-auto border-b border-[#DFE6EF] bg-white/85 backdrop-blur-xl transition-all duration-300">
                    {tasks.map((task) => (
                        <div key={task.id} className="animate-in fade-in slide-in-from-top-1 border-b border-[#EEF3F8] px-4 py-2.5 last:border-none">
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${task.status === 'error' ? 'text-red-500' : 'text-[#6A778E]'}`}>
                                    {task.status === 'active' && <Sparkles size={10} className="animate-pulse text-[#2F6FFF]" />}
                                    {task.label}
                                </span>
                                <span className={`min-w-[34px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black ${task.status === 'error'
                                    ? 'bg-red-50 text-red-500'
                                    : 'bg-[#EEF3FF] text-[#3E59C9]'
                                    }`}>
                                    {Math.round(task.percent)}%
                                </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[#EEF2F6]">
                                <div
                                    className={`h-full transition-all duration-500 ease-out ${task.status === 'error'
                                        ? 'bg-red-400'
                                        : 'bg-gradient-to-r from-[#2F6FFF] to-[#5F92FF]'
                                        } ${task.status === 'active' ? 'animate-pulse' : ''}`}
                                    style={{ width: `${task.percent}%` }}
                                />
                            </div>
                            {task.message && (
                                <p className={`mt-1 text-[9px] font-bold ${task.status === 'error' ? 'text-red-500/80' : 'text-[#8D98A9]'}`}>
                                    {task.message}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <main
                className="relative flex-1 overflow-hidden"
                style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
            >
                <div className={`pointer-events-none sticky top-0 z-20 h-[2px] w-full bg-gradient-to-r ${moduleAccent.line}`} />

                <div className={`page-container ${activeTab === Tab.Rubric ? 'flex' : 'hidden'} h-full flex-col`}>
                    <RubricPanel />
                </div>

                <div className={`page-container ${activeTab === Tab.Grading ? 'flex' : 'hidden'} h-full flex-col`}>
                    <GradingViewV2 />
                </div>

                <div className={`page-container ${activeTab === Tab.History ? 'flex' : 'hidden'} h-full flex-col`}>
                    <RecordsViewV2 />
                </div>

                <div className={`page-container ${activeTab === Tab.Settings ? 'flex' : 'hidden'} h-full flex-col overflow-y-auto`}>
                    <SettingsViewV2 />
                </div>
            </main>

            <nav
                className="fixed bottom-0 left-0 right-0 z-30 flex h-14 w-full shrink-0 items-center justify-around border-t border-[#DCE4EF] bg-white/96 px-1 shadow-[0_-10px_28px_-18px_rgba(31,50,81,0.35)] backdrop-blur-xl"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <NavButton
                    active={activeTab === Tab.Rubric}
                    onClick={() => setActiveTab(Tab.Rubric)}
                    icon={<FileText size={20} strokeWidth={activeTab === Tab.Rubric ? 2.3 : 1.9} />}
                    label="细则"
                    hideLabel={isNarrow}
                    activeColor="text-[#3E59C9]"
                    indicatorColor="rgba(47, 111, 255,0.7)"
                    pillClass="bg-[#EEF3FF] border border-[#D7E3FF]"
                />
                <NavButton
                    active={activeTab === Tab.Grading}
                    onClick={() => setActiveTab(Tab.Grading)}
                    icon={<CheckCircle2 size={20} strokeWidth={activeTab === Tab.Grading ? 2.3 : 1.9} />}
                    label="阅卷"
                    hideLabel={isNarrow}
                    activeColor="text-[#4978C4]"
                    indicatorColor="rgba(95,138,237,0.7)"
                    pillClass="bg-[#EDF4FF] border border-[#D3E3FA]"
                />
                <NavButton
                    active={activeTab === Tab.History}
                    onClick={() => setActiveTab(Tab.History)}
                    icon={<History size={20} strokeWidth={activeTab === Tab.History ? 2.3 : 1.9} />}
                    label="记录"
                    hideLabel={isNarrow}
                    activeColor="text-[#8366A4]"
                    indicatorColor="rgba(143,159,204,0.75)"
                    pillClass="bg-[#F4F0FA] border border-[#E6DAF6]"
                />
                <NavButton
                    active={activeTab === Tab.Settings}
                    onClick={() => setActiveTab(Tab.Settings)}
                    icon={<Settings2 size={20} strokeWidth={activeTab === Tab.Settings ? 2.3 : 1.9} />}
                    label="设置"
                    hideLabel={isNarrow}
                    activeColor="text-[#5E728D]"
                    indicatorColor="rgba(149,168,194,0.8)"
                    pillClass="bg-[#F1F4F8] border border-[#DDE5F0]"
                />
            </nav>
        </div>
    );
}

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    hideLabel?: boolean;
    activeColor: string;
    indicatorColor: string;
    pillClass: string;
}

function NavButton({
    active,
    onClick,
    icon,
    label,
    hideLabel,
    activeColor,
    indicatorColor,
    pillClass
}: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={`relative flex h-full min-w-[44px] flex-col items-center justify-center gap-0.5 px-2 transition-all duration-300 ${active ? `${activeColor} scale-[1.02]` : 'text-[#8B99AD] hover:text-[#63768F]'
                }`}
        >
            {active && (
                <div
                    className="absolute -top-[1px] h-[2px] w-8 rounded-full"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${indicatorColor}, transparent)`,
                        boxShadow: `0 0 8px ${indicatorColor}`
                    }}
                />
            )}
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${active ? pillClass : ''}`}>
                {icon}
            </div>
            {!hideLabel && (
                <span className={`text-[10px] font-black tracking-wider transition-all ${active ? 'opacity-100' : 'opacity-50'}`}>
                    {label}
                </span>
            )}
        </button>
    );
}
