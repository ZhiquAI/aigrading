import React, { useState } from 'react';
import { Key, ShieldCheck, HelpCircle, X, ChevronRight, Zap, Info } from 'lucide-react';
import { Button } from './ui';
import { useAppStore } from '@/stores/useAppStore';

interface ActivationModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

export default function ActivationModal({ onSuccess, onClose }: ActivationModalProps) {
    const { setActivationCode } = useAppStore();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('error');

    const [clipboardCode, setClipboardCode] = useState('');

    // 检查剪贴板是否存有效激活码
    React.useEffect(() => {
        const checkClipboard = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const text = await navigator.clipboard.readText();
                const cleanText = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                // 验证是否是 16 位代码
                if (cleanText.length === 16) {
                    // 格式化展示
                    const chunks = cleanText.match(/.{1,4}/g);
                    setClipboardCode(chunks ? chunks.join('-') : cleanText);
                }
            } catch (err) {
                // 剪贴板权限可能被拒绝
            }
        };

        // 只有在弹窗打开时检查一次
        checkClipboard();

        // 监听焦点变化以捕捉新复制的代码
        window.addEventListener('focus', checkClipboard);
        return () => window.removeEventListener('focus', checkClipboard);
    }, []);

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // 自动添加连字符
        if (value.length > 4) {
            const chunks = value.match(/.{1,4}/g);
            if (chunks) {
                value = chunks.join('-');
            }
        }

        // 限制长度 (16位字符 + 3个连字符 = 19)
        if (value.replace(/-/g, '').length <= 16) {
            setCode(value);
        }
    };

    const handleActivate = async () => {
        const cleanCode = code.replace(/-/g, '');
        if (!cleanCode || cleanCode.length !== 16) {
            setMessage('请输入完整的 16 位激活码');
            setMessageType('error');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const { verifyActivation } = await import('../services/cloudbaseService');
            const { getDeviceId } = await import('../utils/device');
            const deviceId = getDeviceId();

            const result = await verifyActivation(code, deviceId);

            if (result.success) {
                // 更新全局状态 (Suggestion 2)
                setActivationCode(code);

                setMessage(result.message || '激活成功！');
                setMessageType('success');
                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
            } else {
                setMessage(result.message || '激活失败，请检查激活码是否正确');
                setMessageType('error');
            }
        } catch (err) {
            console.error('[ActivationModal] Activation error:', err);
            setMessage('激活失败，请稍后重试');
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !loading) {
            handleActivate();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Visual Header */}
                <div className="relative h-32 bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="relative flex flex-col items-center gap-2">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                            <Key className="text-white bg-transparent" size={28} />
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">输入激活码</h3>
                        <p className="text-sm text-slate-400 mt-1">请输入您的 16 位序列号以充值额度</p>
                    </div>

                    <div className="space-y-4">
                        <div className={`relative group ${messageType === 'error' && message ? 'animate-shake' : ''}`}>
                            <input
                                type="text"
                                value={code}
                                onChange={handleCodeChange}
                                onKeyDown={handleKeyPress}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                className={`w-full bg-slate-50 border-2 px-4 py-4 rounded-2xl text-center font-mono text-lg font-bold tracking-widest outline-none transition-all ${messageType === 'error' && message
                                    ? 'border-red-100 focus:border-red-400 text-red-600'
                                    : 'border-slate-100 group-hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/10 text-slate-700'
                                    }`}
                                autoFocus
                                disabled={loading}
                            />
                            {clipboardCode && code !== clipboardCode && (
                                <button
                                    onClick={() => {
                                        setCode(clipboardCode);
                                        setClipboardCode(''); // Clear hint after use
                                    }}
                                    className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-xl shadow-indigo-300 animate-in zoom-in-90 fade-in duration-300 hover:bg-indigo-700 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap z-10 group/magic"
                                >
                                    <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center animate-[pulse_1.5s_infinite]">
                                        <Zap size={10} className="fill-current group-hover/magic:scale-110 transition-transform" />
                                    </div>
                                    <span className="opacity-90">发现序列号：</span>
                                    <span className="font-mono">{clipboardCode}</span>
                                    <div className="w-[1px] h-3 bg-white/20 mx-1"></div>
                                    <span>点击填入</span>
                                </button>
                            )}
                            {loading && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <div className="w-5 h-5 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {message && (
                            <div className={`p-3 rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 duration-200 ${messageType === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                }`}>
                                {messageType === 'success' ? <ShieldCheck size={16} className="shrink-0 mt-0.5" /> : <Info size={16} className="shrink-0 mt-0.5" />}
                                <span className="text-xs font-bold leading-relaxed">{message}</span>
                            </div>
                        )}

                        <Button
                            variant="gradient"
                            onClick={handleActivate}
                            disabled={loading || code.replace(/-/g, '').length === 0}
                            fullWidth
                            className={`py-4 rounded-2xl shadow-lg shadow-indigo-200 font-black tracking-widest text-base group active:scale-95 transition-all ${loading ? 'opacity-90' : ''}`}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    验证中...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    立即激活
                                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </Button>

                        <style dangerouslySetInnerHTML={{
                            __html: `
                            @keyframes shake {
                                0%, 100% { transform: translateX(0); }
                                20%, 60% { transform: translateX(-4px); }
                                40%, 80% { transform: translateX(4px); }
                            }
                            .animate-shake {
                                animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                            }
                        `}} />
                    </div>

                    {/* How to get section */}
                    <div className="mt-8 pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-indigo-600 mb-3 ml-1">
                            <HelpCircle size={16} />
                            <span className="text-xs font-black uppercase tracking-wider">如何获取激活码？</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { step: 1, text: '点击“购买额度”', icon: <Zap size={14} className="text-orange-500" /> },
                                { step: 2, text: '扫码支付后联系客服', icon: <Info size={14} className="text-blue-500" /> },
                                { step: 3, text: '获取 16 位代码并输入', icon: <ShieldCheck size={14} className="text-emerald-500" /> }
                            ].map((item) => (
                                <div key={item.step} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                                    <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors">
                                        {item.step}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">{item.text}</span>
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.icon}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
