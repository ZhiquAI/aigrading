import React, { useState } from 'react';
import { verifyActivation } from '../services/cloudbaseService';
import { getDeviceId } from '../utils/device';

interface ActivationModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

export default function ActivationModal({ onSuccess, onClose }: ActivationModalProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('error');

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // 自动添加连字符
        if (value.length > 4) {
            value = value.match(/.{1,4}/g)!.join('-');
        }

        // 限制长度
        if (value.replace(/-/g, '').length <= 16) {
            setCode(value);
        }
    };

    const handleActivate = async () => {
        if (!code.trim() || code.replace(/-/g, '').length !== 16) {
            setMessage('请输入完整的16位激活码');
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
                setMessage(result.message || '激活成功！');
                setMessageType('success');

                // 显示成功提示 1.5秒后关闭
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl p-4 shadow-float border border-gray-100 w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined text-gray-400 text-[20px]">close</span>
                </button>

                {/* 标题 */}
                <div className="text-center mb-4">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600 text-[24px]">vpn_key</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">输入激活码</h3>
                    <p className="text-xs text-gray-500 mt-1">请输入16位激活码充值额度</p>
                </div>

                {/* 输入框 */}
                <input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyPress={handleKeyPress}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2.5 text-sm text-center font-mono rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    maxLength={19}
                    autoFocus
                    disabled={loading}
                />

                {/* 提示 */}
                <p className="text-[10px] text-gray-400 text-center mt-2">
                    示例: <code className="bg-gray-100 px-1 rounded">TEST-1111-2222-3333</code>
                </p>

                {/* 消息提示 */}
                {message && (
                    <div className={`mt-3 p-3 rounded-lg border ${messageType === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-start gap-2">
                            <span className={`material-symbols-outlined text-[16px] mt-0.5 ${messageType === 'success' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {messageType === 'success' ? 'check_circle' : 'error'}
                            </span>
                            <p className={`text-xs font-medium ${messageType === 'success' ? 'text-green-900' : 'text-red-900'
                                }`}>
                                {message}
                            </p>
                        </div>
                    </div>
                )}

                {/* 激活按钮 */}
                <button
                    onClick={handleActivate}
                    disabled={loading || code.length === 0}
                    className="w-full mt-4 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? '验证中...' : '激活'}
                </button>

                {/* 帮助信息 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5">info</span>
                        <div>
                            <p className="text-[10px] font-bold text-gray-700 mb-1">如何获取激活码？</p>
                            <ol className="text-[10px] text-gray-500 space-y-0.5 pl-3 list-decimal">
                                <li>点击"购买额度"</li>
                                <li>扫码支付后联系客服</li>
                                <li>获取激活码并输入</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
