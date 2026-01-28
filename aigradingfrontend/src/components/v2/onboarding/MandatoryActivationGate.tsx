import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import {
    ShieldCheck,
    Zap,
    Lock,
    CheckCircle2,
    Loader2,
    QrCode,
    Sparkles,
    ChevronRight,
    Play
} from 'lucide-react';

export const MandatoryActivationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { activationCode, quota, setActivationCode, syncQuota } = useAppStore();

    // UI State
    const [step, setStep] = useState(1); // 1: Welcome, 2: Activation

    const [inputCode, setInputCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [showTrialInfo, setShowTrialInfo] = useState(false);
    const [isTrialExhausted, setIsTrialExhausted] = useState(false);

    useEffect(() => {
        if (activationCode && !quota.isPaid && quota.remaining <= 0) {
            setIsTrialExhausted(true);
        } else {
            setIsTrialExhausted(false);
        }
    }, [activationCode, quota.isPaid, quota.remaining]);

    // 核心逻辑：是否已激活
    // 我们认为有 activationCode 且余额 > 0 或被标记为 isPaid 则是激活状态
    const isActivated = !!activationCode && (quota.remaining > 0 || quota.isPaid);

    useEffect(() => {
        // 初始同步一次状态
        if (activationCode) {
            syncQuota();
        }
    }, []);

    const handleVerify = async () => {
        if (!inputCode.trim()) {
            toast.error('请输入激活码');
            return;
        }

        setIsVerifying(true);
        try {
            await setActivationCode(inputCode.trim());
            // syncQuota 会在 setActivationCode 内部被调用
            setIsVerifying(false);
            toast.success('激活成功！');
        } catch (err) {
            toast.error('激活失败，请检查网络或激活码');
            setIsVerifying(false);
        }
    };

    // 模拟购买完成后自动升级的逻辑
    const handlePurchaseSuccess = async () => {
        setIsVerifying(true);
        try {
            // 这里通常是后端回调后，前端重新同步
            // 模拟：充值后余额增加，后端会将 type 改为非 trial
            await syncQuota();
            setIsVerifying(false);
            toast.success('感谢支持！专业版已自动激活');
        } catch (err) {
            setIsVerifying(false);
        }
    };

    if (isActivated) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-4 overflow-hidden font-sans">
            {/* Custom Animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0%, 100% { transform: translateY(0) scale(1.02); }
                    50% { transform: translateY(-10px) scale(1); }
                }
                .animate-float {
                    animation: float 6s infinite ease-in-out;
                }
                .slide-up-exit {
                    transform: translateY(-100%);
                    opacity: 0;
                    transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `}} />

            <div className="relative w-full max-w-md aspect-[9/16] max-h-[800px] bg-white rounded-[48px] shadow-2xl overflow-hidden flex flex-col">

                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-50 to-transparent pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />

                {/* Step 1: Zero-Jump Welcome (Overlaid) */}
                <div
                    className={`absolute inset-0 z-30 bg-indigo-600 flex flex-col transition-all duration-700 ease-in-out ${step === 2 ? 'translate-y-[-100%]' : ''}`}
                >
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white">
                        {/* App Icon / Mascot */}
                        <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-10 animate-float backdrop-blur-sm border border-white/10">
                            <div className="w-24 h-24 bg-white rounded-3xl rotate-12 flex items-center justify-center shadow-2xl">
                                <Sparkles className="w-12 h-12 text-indigo-600" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-black mb-4 tracking-tighter">欢迎来到专业版</h1>
                        <p className="text-sm text-indigo-100/80 leading-relaxed mb-12 px-4 font-medium">
                            告别重复机械的评分工作。<br />AI 深度理解历史语义，数秒内完成标准化评分。
                        </p>

                        {/* Feature Quick Info */}
                        <div className="grid grid-cols-2 gap-3 w-full mb-12">
                            <div className="bg-white/10 p-4 rounded-3xl border border-white/10 text-left backdrop-blur-sm">
                                <div className="text-indigo-200 mb-1 font-black text-[10px] uppercase tracking-widest">Speed</div>
                                <div className="text-xs font-bold">5s 极速响应</div>
                            </div>
                            <div className="bg-white/10 p-4 rounded-3xl border border-white/10 text-left backdrop-blur-sm">
                                <div className="text-indigo-200 mb-1 font-black text-[10px] uppercase tracking-widest">Precision</div>
                                <div className="text-xs font-bold">考点精准对齐</div>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            className="w-full bg-white text-indigo-600 py-5 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all group flex items-center justify-center gap-2"
                        >
                            <span>立即开启探索</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Step 2: Activation Form */}
                <div className="flex flex-col h-full relative z-10 bg-slate-50">

                    {/* Header / Stepper */}
                    <div className="p-8 pb-0 pt-10 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activation Setup</span>
                    </div>

                    <div className="flex-1 flex flex-col px-8 relative z-10 pt-6">
                        <div className="mb-8">
                            <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">
                                {isTrialExhausted ? '试用额度已用完' : '激活以开始阅卷'}
                            </h1>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                {isTrialExhausted
                                    ? '您的试用额度已耗尽。升级为正式会员，解锁无限批改可能并开启云端同步功能。'
                                    : '请输入您收到的 16 位激活码以解锁专业版功能。'}
                            </p>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                            {isTrialExhausted ? (
                                /* Trial Exhausted View */
                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6 rounded-[32px] space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                                <Sparkles size={20} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Upgrade to</div>
                                                <div className="text-lg font-black text-amber-900">专业正式版</div>
                                            </div>
                                        </div>
                                        <ul className="space-y-2">
                                            {[
                                                '云端多端同步记录',
                                                '考试/细则云端备份',
                                                '优先响应技术支持',
                                                '专属大模型优化路径'
                                            ].map((f, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs font-bold text-amber-800">
                                                    <CheckCircle2 size={14} className="text-amber-500" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="bg-white border-2 border-indigo-100 p-5 rounded-[32px] flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">限时特惠</span>
                                            <span className="text-2xl font-black text-slate-900">¥199<span className="text-sm text-slate-400 font-bold ml-1">/年</span></span>
                                        </div>
                                        <button
                                            onClick={handlePurchaseSuccess}
                                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                                        >
                                            立即升级
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setIsTrialExhausted(false)}
                                        className="w-full py-2 text-xs text-slate-400 font-bold hover:text-slate-600 transition-colors"
                                    >
                                        我有新激活码，去输入 →
                                    </button>
                                </div>
                            ) : (
                                /* Standard Activation View */
                                <>
                                    {/* Activation Code Input */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                                            <span>输入激活码</span>
                                            <button
                                                onClick={() => setShowTrialInfo(!showTrialInfo)}
                                                className="text-indigo-600 hover:underline"
                                            >
                                                如何获取？
                                            </button>
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={inputCode}
                                                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                                placeholder="ZY-XXXX-XXXX"
                                                className="w-full bg-white border-2 border-slate-200 rounded-[24px] p-6 text-xl font-black tracking-widest text-indigo-600 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Trial Message / Path - WeChat Guide */}
                                    <div className={`p-5 rounded-[28px] bg-indigo-50 border border-indigo-100 space-y-3 transition-all duration-300 ${showTrialInfo ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                                <Zap size={16} strokeWidth={3} />
                                            </div>
                                            <span className="text-xs font-black text-indigo-900">没有激活码？</span>
                                        </div>
                                        <p className="text-[11px] text-indigo-600/70 leading-relaxed">
                                            新教师可申请 <strong>10 次免费试用</strong>。请关注公众号获取专属试用码。
                                        </p>

                                        {showTrialInfo && (
                                            <div className="mt-3 bg-white p-3 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="bg-slate-100 p-2 rounded-xl">
                                                    <QrCode className="w-12 h-12 text-slate-800" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-slate-700">1. 扫码关注公众号</p>
                                                    <p className="text-[10px] font-bold text-slate-700">2. 回复 <span className="text-indigo-600">"试用"</span></p>
                                                </div>
                                            </div>
                                        )}

                                        {!showTrialInfo && (
                                            <button
                                                onClick={() => setShowTrialInfo(true)}
                                                className="w-full py-3 bg-white border border-indigo-200 rounded-xl text-indigo-600 text-xs font-bold hover:shadow-md transition-all"
                                            >
                                                立即申领试用码
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="pb-8 pt-4">
                            {!isTrialExhausted && (
                                <button
                                    disabled={isVerifying}
                                    onClick={handleVerify}
                                    className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black text-base shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:scale-100"
                                >
                                    {isVerifying ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        <>
                                            <span>验证并进入系统</span>
                                            <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            )}
                            <p className="text-center text-[10px] text-slate-400 mt-6 font-medium">
                                激活后即表示您同意 <span className="underline cursor-pointer">服务协议</span> 与 <span className="underline cursor-pointer">隐私政策</span>
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
