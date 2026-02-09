import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { verifyActivationCode } from '@/services/proxyService';
import {
    ShieldCheck,
    Zap,
    CheckCircle2,
    Loader2,
    QrCode
} from 'lucide-react';

export const MandatoryActivationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { activationCode, quota, setActivationCode, syncQuota } = useAppStore();

    // UI State
    const [inputCode, setInputCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [showTrialInfo, setShowTrialInfo] = useState(false);
    const [isTrialExhausted, setIsTrialExhausted] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const maskCode = (code: string) => {
        if (code.length <= 8) return code;
        return `${code.slice(0, 4)}****${code.slice(-4)}`;
    };

    const normalizeActivationError = (message?: string) => {
        if (!message) return '激活失败，请检查激活码';
        if (message.includes('不存在')) return '激活码不存在，请核对后重试';
        if (message.includes('禁用')) return '激活码已被禁用，请联系管理员';
        if (message.includes('过期')) return '激活码已过期，请联系管理员';
        if (message.includes('最大设备') || message.includes('设备绑定')) {
            return '设备数超限，请联系管理员';
        }
        return message;
    };

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
        if (activationCode) {
            syncQuota();
        }
    }, [activationCode, syncQuota]);

    const handleVerify = async () => {
        const code = inputCode.trim().toUpperCase();
        if (!code) {
            toast.error('请输入激活码');
            return;
        }

        setIsVerifying(true);
        setErrorMessage(null);
        console.info('[Activation] verify start', { code: maskCode(code) });
        try {
            const result = await verifyActivationCode(code);
            if (!result.success) {
                const msg = normalizeActivationError(result.message);
                setErrorMessage(msg);
                toast.error(msg);
                console.info('[Activation] verify result', {
                    code: maskCode(code),
                    success: false,
                    message: result.message
                });
                return;
            }

            setActivationCode(code);
            await syncQuota();
            toast.success(result.message || '激活成功！');
            console.info('[Activation] verify result', {
                code: maskCode(code),
                success: true,
                message: result.message
            });
        } catch (err) {
            console.error('[Activation] verify error:', err);
            setErrorMessage('激活失败，请检查网络或激活码');
            toast.error('激活失败，请检查网络或激活码');
        } finally {
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
            toast.success('感谢支持！专业版已自动激活');
        } catch (err) {
            // 保持静默
        } finally {
            setIsVerifying(false);
        }
    };

    if (isActivated) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-white text-slate-800 font-sans">
            {/* Background Atmosphere */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-indigo-500/5 blur-[120px] pointer-events-none" />

            <div className="flex h-full w-full flex-col">
                {/* Header */}
                <header className="relative bg-white/90 backdrop-blur-xl border-b border-slate-100 px-3 h-12 flex items-center justify-between">
                    <div className="absolute inset-0 pointer-events-none bg-indigo-50/60" />
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500" />
                    <div className="relative z-10 flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                            <ShieldCheck size={14} className="text-white" />
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="font-black text-sm tracking-tight text-slate-900">激活账户</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-400">Activation</span>
                        </div>
                    </div>
                    <div className="relative z-10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {quota.isPaid ? 'Member' : 'Trial'}
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto bg-slate-50/30 p-4">
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
                                {isTrialExhausted ? '试用额度已用完' : '激活以开始阅卷'}
                            </h1>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {isTrialExhausted
                                    ? '您的试用额度已耗尽。升级为正式会员，解锁无限批改并开启云端同步功能。'
                                    : '请输入您收到的 16 位激活码以解锁专业版功能。'}
                            </p>
                        </div>

                        {isTrialExhausted ? (
                            <div className="space-y-3">
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-sm">
                                            <Zap size={16} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Upgrade to</div>
                                            <div className="text-base font-black text-amber-900">专业正式版</div>
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

                                <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">限时特惠</span>
                                        <span className="text-xl font-black text-slate-900">¥199<span className="text-xs text-slate-400 font-bold ml-1">/年</span></span>
                                    </div>
                                    <button
                                        onClick={handlePurchaseSuccess}
                                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-indigo-100 active:scale-95 transition-all"
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
                            <div className="space-y-3">
                                {/* Activation Code Input */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                                        <span>输入激活码</span>
                                        <button
                                            onClick={() => setShowTrialInfo(!showTrialInfo)}
                                            className="text-indigo-600 hover:underline"
                                        >
                                            如何获取？
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={inputCode}
                                        onChange={(e) => {
                                            setInputCode(e.target.value.toUpperCase());
                                            if (errorMessage) setErrorMessage(null);
                                        }}
                                        placeholder="ZY-XXXX-XXXX"
                                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-base font-black tracking-widest text-indigo-600 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                                    />
                                    {errorMessage && (
                                        <p className="text-[11px] text-red-500 font-bold mt-2">
                                            {errorMessage}
                                        </p>
                                    )}
                                </div>

                                {/* Trial Message / Path - WeChat Guide */}
                                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                                            <Zap size={14} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-xs font-black text-indigo-900">没有激活码？</span>
                                    </div>
                                    <p className="text-[11px] text-indigo-600/80 leading-relaxed">
                                        新教师可申请 <strong>10 次免费试用</strong>。请关注公众号获取专属试用码。
                                    </p>

                                    {showTrialInfo ? (
                                        <div className="mt-2 bg-white p-3 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="bg-slate-100 p-2 rounded-lg">
                                                <QrCode className="w-10 h-10 text-slate-800" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-700">1. 扫码关注公众号</p>
                                                <p className="text-[10px] font-bold text-slate-700">2. 回复 <span className="text-indigo-600">"试用"</span></p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowTrialInfo(true)}
                                            className="w-full py-2.5 bg-white border border-indigo-200 rounded-lg text-indigo-600 text-xs font-bold hover:shadow-md transition-all"
                                        >
                                            立即申领试用码
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {!isTrialExhausted && (
                    <div className="border-t border-slate-100 bg-white/90 backdrop-blur-xl p-4">
                        <button
                            disabled={isVerifying}
                            onClick={handleVerify}
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
                        >
                            {isVerifying ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <span>验证并进入系统</span>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-slate-400 mt-4 font-medium">
                            激活后即表示您同意 <span className="underline cursor-pointer">服务协议</span> 与 <span className="underline cursor-pointer">隐私政策</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
