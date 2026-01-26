import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { toast } from '@/components/Toast';
import QuotaDisplay from '@/components/QuotaDisplay';
import ActivationModal from '@/components/ActivationModal';
import PrivacyPolicy from '@/components/PrivacyPolicy';
import SuccessCelebration from '@/src/components/v2/SuccessCelebration';
import {
    Settings,
    Shield,
    Trash2,
    Crown,
    Zap,
    Cpu,
    Brain,
    CheckCircle2,
    Circle,
    Server,
    Wifi,
    WifiOff,
    Key,
    Eye,
    EyeOff,
    LogOut,
    ChevronDown,
    Building2,
    UserCircle,
    Monitor,
    Moon,
    Sun,
    Info,
    CreditCard,
    Check
} from 'lucide-react';
import { GradingStrategy, testConnection } from '@/services/geminiService';
import { getAppConfig, saveAppConfig, PROVIDER_DEFAULTS } from '@/services/config-service';
import { clearAllImages } from '@/utils/imageDB';

// @ts-ignore - Vite Env
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

const SettingsViewV2: React.FC = () => {
    const { appMode, setAppMode, status, quota, activationCode } = useAppStore();
    const { isDark, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    // Models
    const [isActivationOpen, setIsActivationOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);

    // Personal Mode State
    const [apiConfig, setApiConfig] = useState(() => getAppConfig());
    const [showApiKey, setShowApiKey] = useState(false);
    const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [currentStrategy, setCurrentStrategy] = useState<GradingStrategy>('pro'); // Local state for Personal Mode

    // Save Config Handler
    const handleSaveConfig = () => {
        try {
            saveAppConfig(apiConfig);
            toast.success('配置已保存');
        } catch (e) {
            toast.error('保存失败');
        }
    };

    // Test Connection Handler
    const handleTestConnection = async () => {
        if (!apiConfig.apiKey) return toast.error('请输入 API Key');
        setApiTestStatus('testing');
        try {
            const success = await testConnection(apiConfig);
            if (success) {
                setApiTestStatus('success');
                toast.success('连接成功');
            } else {
                throw new Error('连接失败');
            }
        } catch (e: any) {
            setApiTestStatus('error');
            toast.error(e.message || '连接失败');
        }
    };

    // Render Enterprise Mode (Default/SaaS)
    const renderEnterpriseMode = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 1. Quota Card */}
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/5 flex justify-between items-center text-slate-800">
                    <h3 className="font-black text-xs flex items-center gap-2 uppercase tracking-widest text-slate-500">
                        {quota.isPaid ? <Crown className="w-4 h-4 text-orange-500" /> : <Zap className="w-4 h-4 text-indigo-500" />}
                        {quota.isPaid ? '专业版配额' : '试用版配额'}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black border tracking-wider transition-colors animate-shimmer-fast
                        ${quota.status === 'expired'
                            ? 'bg-red-50 text-red-600 border-red-100 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                            : quota.isPaid
                                ? 'bg-orange-50 text-orange-600 border-orange-100 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {quota.status === 'expired' ? 'EXPIRED' : quota.isPaid ? 'PRO' : 'TRIAL'}
                    </span>
                </div>
                <div className={`p-0 relative ${quota.status === 'expired' ? 'grayscale opacity-50' : ''}`}>
                    <QuotaDisplay
                        onPurchaseClick={() => window.open(`${API_BASE_URL}/pay`, '_blank')}
                        onActivateClick={() => setIsActivationOpen(true)}
                    />
                    {quota.status === 'expired' && (
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">试用期已结束</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Activation / Account Card */}
            {quota.isPaid ? (
                /* PROFESSIONAL STATE: Sleek ID Card with Shimmer */
                <div className="bg-[#0f172a] rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden group border border-white/10">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes shimmer {
                            0% { transform: translateX(-150%) skewX(-20deg); }
                            100% { transform: translateX(150%) skewX(-20deg); }
                        }
                        @keyframes shimmer-fast {
                            0% { transform: translateX(-200%); }
                            100% { transform: translateX(200%); }
                        }
                        .shimmer-mask::after {
                            content: "";
                            position: absolute;
                            top: 0; left: 0; width: 100%; height: 100%;
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.02), rgba(255,255,255,0.1), rgba(255,255,255,0.02), transparent);
                            animation: shimmer 4s infinite linear;
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
                    `}} />

                    <div className="shimmer-mask absolute inset-0 pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-10"></div>

                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-tr from-amber-200 to-yellow-500 p-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                <div className="bg-[#0f172a] rounded-full p-1">
                                    <Crown size={12} className="text-yellow-400 fill-current" />
                                </div>
                            </div>
                            <h3 className="font-black text-sm tracking-tight text-white/90">账号身份</h3>
                        </div>
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-400/20">
                            <Shield className="w-3 h-3" /> 已认证
                        </span>
                    </div>

                    <div className="flex items-center gap-4 mb-8 relative z-10 bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center border border-white/10 shadow-xl">
                            <UserCircle className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Account ID</p>
                            <h3 className="text-lg font-mono font-bold tracking-widest text-white/90">
                                {activationCode ? `${activationCode.substring(0, 4)}-****-****-${activationCode.slice(-4)}` : 'UNKNOWN-ID'}
                            </h3>
                        </div>
                    </div>

                    <div className="flex gap-3 relative z-10">
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setIsActivationOpen(true)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm py-3 rounded-xl shadow-lg shadow-indigo-500/20 border-0 active:scale-95 transition-all"
                        >
                            追加额度
                        </Button>
                        <button className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-colors border border-white/5">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ) : (
                /* TRIAL STATE: Premium Conversion Card */
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                    <div className="absolute -top-4 -right-4 w-28 h-28 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>

                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
                            <Zap className="w-7 h-7 text-yellow-300 animate-pulse" />
                        </div>
                        <div className="text-right">
                            <h3 className="font-black text-xl tracking-tight">年度专业版</h3>
                            <p className="text-[11px] text-indigo-100 font-bold opacity-80">开启极致阅卷体验</p>
                        </div>
                    </div>

                    {/* Benefit Comparison List */}
                    <div className="space-y-2.5 mb-8 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                        {[
                            '云端永久存储评分细则',
                            '全平台同步批改历史记录',
                            '优先响应级 AI 专家模型',
                            '专属“已批阅”精美印章'
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-indigo-50">
                                <div className="w-4 h-4 rounded-full bg-emerald-400/30 flex items-center justify-center border border-emerald-400/20">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300" strokeWidth={4} />
                                </div>
                                {benefit}
                            </div>
                        ))}
                    </div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes shadowPulse {
                            0% { box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.2); }
                            50% { box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.4); }
                            100% { box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.2); }
                        }
                        .animate-shadow-pulse {
                            animation: shadowPulse 3s infinite ease-in-out;
                        }
                    `}} />
                    <Button
                        onClick={() => setIsActivationOpen(true)}
                        className="w-full bg-white text-indigo-900 hover:bg-indigo-50 active:scale-95 transition-all border-0 font-black text-base py-4 rounded-2xl shadow-xl shadow-indigo-900/20 animate-shadow-pulse"
                    >
                        输入激活码加入
                    </Button>
                </div>
            )}
        </div>
    );

    // Render Personal Mode (BYOK)
    const renderPersonalMode = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* 1. Provider Selection */}
            <section className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">AI 服务商</label>
                <div className="grid grid-cols-2 gap-2">
                    {(['google', 'openai', 'zhipu', 'alibaba'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => {
                                const defs = PROVIDER_DEFAULTS[p];
                                setApiConfig(prev => ({ ...prev, provider: p, endpoint: defs.endpoint, modelName: defs.model }));
                            }}
                            className={`p-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${apiConfig.provider === p
                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                        >
                            <Server className={`w-4 h-4 ${apiConfig.provider === p ? 'text-blue-500' : 'text-slate-400'}`} />
                            {p === 'google' ? 'Google Gemini' : p === 'openai' ? 'OpenAI' : p === 'zhipu' ? '智谱 AI' : '阿里云百炼'}
                        </button>
                    ))}
                </div>
            </section>

            {/* 2. API Key Input */}
            <section className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">API 配置</label>
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
                    {apiConfig.provider !== 'google' && (
                        <div>
                            <label className="text-xs text-slate-500 font-medium mb-1 block">Endpoint</label>
                            <input
                                type="text"
                                value={apiConfig.endpoint}
                                onChange={e => setApiConfig({ ...apiConfig, endpoint: e.target.value })}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-colors font-mono"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-slate-500 font-medium mb-1 block">API Key</label>
                        <div className="relative">
                            <input
                                type={showApiKey ? "text" : "password"}
                                value={apiConfig.apiKey}
                                onChange={e => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                                placeholder="sk-..."
                                className="w-full text-xs p-2 pl-8 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-colors font-mono"
                            />
                            <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleTestConnection}
                            loading={apiTestStatus === 'testing'}
                            className="flex-1"
                        >
                            {apiTestStatus === 'success' ? <Wifi className="w-3.5 h-3.5 mr-1 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 mr-1" />}
                            测试连接
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={handleSaveConfig}
                            className="flex-1"
                        >
                            保存配置
                        </Button>
                    </div>
                </div>
            </section>

            {/* 3. Model Strategy Selection */}
            <section className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">默认模型</label>
                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={() => setCurrentStrategy('flash')}
                        className={`p-3 rounded-xl border text-left transition-all ${currentStrategy === 'flash' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-slate-700">快速模式 (Flash)</span>
                            <Zap className="w-3.5 h-3.5 text-green-500" />
                        </div>
                        <p className="text-xs text-slate-500">速度最快，适合简单题。消耗极低。</p>
                    </button>

                    <button
                        onClick={() => setCurrentStrategy('pro')}
                        className={`p-3 rounded-xl border text-left transition-all ${currentStrategy === 'pro' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-slate-700">精准模式 (Pro)</span>
                            <Brain className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <p className="text-xs text-slate-500">平衡速度与质量，适合大多数场景。</p>
                    </button>

                    <button
                        onClick={() => setCurrentStrategy('reasoning')}
                        className={`p-3 rounded-xl border text-left transition-all ${currentStrategy === 'reasoning' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-slate-700">深度推理 (Thinking)</span>
                            <Cpu className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <p className="text-xs text-slate-500">最强推理能力，适合复杂大题。消耗较高。</p>
                    </button>
                </div>
            </section>
        </div>
    );

    return (
        <div className="absolute inset-0 bg-slate-50 flex flex-col">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
                {appMode === 'enterprise' ? renderEnterpriseMode() : renderPersonalMode()}

                <div className="h-px bg-slate-200 my-4" />

                {/* Common Settings */}
                <section className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">通用</label>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                </div>
                                <span className="text-sm font-bold text-slate-700">深色模式</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={toggleTheme} className="text-slate-500">
                                {isDark ? '已开启' : '已关闭'}
                            </Button>
                        </div>

                        <button
                            onClick={() => setIsPrivacyOpen(true)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                    <Shield className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-700">隐私政策</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400 rotate-270" />
                        </button>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="space-y-2">
                    <label className="text-xs font-bold text-red-400 uppercase tracking-wider ml-1">危险区域</label>
                    <div className="bg-white rounded-xl border border-red-100 divide-y divide-red-50 shadow-sm overflow-hidden">
                        <button
                            onClick={async () => {
                                if (confirm('确定要清除所有缓存数据吗？这将丢失所有历史记录和设置。')) {
                                    localStorage.clear();
                                    await clearAllImages();
                                    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                                        chrome.storage.local.clear(() => window.location.reload());
                                    } else {
                                        window.location.reload();
                                    }
                                }
                            }}
                            className="w-full p-4 flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors text-left"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm font-bold">清除所有数据并重置</span>
                        </button>

                        <button
                            onClick={() => {
                                // 仅重置激活状态 (Debug)
                                useAppStore.getState().setActivationCode(null);
                                useAppStore.getState().setHasSeenOnboarding(false);
                                window.location.reload();
                            }}
                            className="w-full p-4 flex items-center gap-3 hover:bg-orange-50 text-orange-600 transition-colors text-left border-t border-red-50"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm font-bold">重置激活状态 (测试欢迎页)</span>
                        </button>
                    </div>
                </section>

                <div className="text-center py-4">
                    <p className="text-[10px] text-slate-400 font-medium">
                        AI Grading Assistant v0.2.0 • Build 2026.01.25
                    </p>
                </div>
            </div>

            {/* Modals */}
            {isActivationOpen && (
                <ActivationModal
                    onSuccess={() => {
                        setIsActivationOpen(false);
                        setShowCelebration(true);
                    }}
                    onClose={() => setIsActivationOpen(false)}
                />
            )}
            {isPrivacyOpen && (
                <PrivacyPolicy
                    isOpen={true}
                    onClose={() => setIsPrivacyOpen(false)}
                />
            )}
            {showCelebration && (
                <SuccessCelebration onComplete={() => setShowCelebration(false)} />
            )}
        </div>
    );
};

export default SettingsViewV2;
