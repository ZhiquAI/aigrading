import React, { useEffect, useState } from 'react';
import { Sparkles, Crown, Check } from 'lucide-react';

interface SuccessCelebrationProps {
    onComplete: () => void;
}

export default function SuccessCelebration({ onComplete }: SuccessCelebrationProps) {
    const [phase, setPhase] = useState<'scaling' | 'shining' | 'fading'>('scaling');

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('shining'), 1000);
        const t2 = setTimeout(() => setPhase('fading'), 3500);
        const t3 = setTimeout(onComplete, 4000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
            {/* Dark Backdrop Fade */}
            <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-1000 ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`} />

            {/* Confetti Particles (Simplified) */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(30)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-float-particle"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            backgroundColor: ['#fbbf24', '#818cf8', '#34d399', '#f472b6'][i % 4],
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: phase === 'fading' ? 0 : 0.6
                        }}
                    />
                ))}
            </div>

            {/* Main Trophy Card */}
            <div className={`
                relative bg-white rounded-[40px] p-10 shadow-2xl transition-all duration-700 max-w-sm w-full text-center
                ${phase === 'scaling' ? 'scale-50 opacity-0 rotate-12' : 'scale-100 opacity-100 rotate-0'}
                ${phase === 'fading' ? 'scale-110 opacity-0 -translate-y-20' : ''}
            `}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes float-particle {
                        0% { transform: translateY(0) rotate(0); }
                        100% { transform: translateY(-100vh) rotate(360deg); }
                    }
                    .animate-float-particle {
                        animation: float-particle 4s linear infinite;
                    }
                    @keyframes beam {
                        0% { transform: rotate(0) scale(1); opacity: 0; }
                        50% { opacity: 0.5; }
                        100% { transform: rotate(180deg) scale(2); opacity: 0; }
                    }
                    .animate-beam {
                        animation: beam 3s infinite linear;
                    }
                `}} />

                {/* Rotating Magic Beams */}
                <div className="absolute inset-x-0 -top-20 flex justify-center pointer-events-none overflow-visible">
                    <div className="w-80 h-80 bg-gradient-to-tr from-indigo-500/20 to-amber-500/20 rounded-full animate-beam absolute" />
                    <div className="w-80 h-80 bg-gradient-to-bl from-purple-500/20 to-emerald-500/20 rounded-full animate-beam absolute" style={{ animationDelay: '-1.5s' }} />
                </div>

                <div className="relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-tr from-amber-200 to-yellow-500 rounded-3xl p-1 shadow-xl shadow-amber-200 mx-auto mb-8 animate-bounce">
                        <div className="w-full h-full bg-[#0f172a] rounded-[22px] flex items-center justify-center">
                            <Crown className="w-12 h-12 text-yellow-400 fill-current" />
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4">身份激活成功!</h2>
                    <p className="text-slate-500 font-bold mb-8">
                        恭喜您解锁 <span className="text-indigo-600">终身专业版权益</span>。<br />
                        现在开始享受极速阅卷体验。
                    </p>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100">
                            <Check className="w-5 h-5 flex-shrink-0" />
                            <span className="text-xs font-black">云端同步已开启</span>
                        </div>
                        <div className="flex items-center gap-3 bg-indigo-50 text-indigo-700 p-3 rounded-2xl border border-indigo-100">
                            <Sparkles className="w-5 h-5 flex-shrink-0" />
                            <span className="text-xs font-black">AI 优先响应已解锁</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
