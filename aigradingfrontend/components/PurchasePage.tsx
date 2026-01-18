import React, { useState } from 'react';

interface Package {
    id: number;
    name: string;
    quota: number;
    price: number;
    validity: number;
    description: string;
    recommended?: boolean;
}

const packages: Package[] = [
    {
        id: 2,
        name: '基础版',
        quota: 1000,
        price: 19.9,
        validity: 90,
        description: '适合轻度使用'
    },
    {
        id: 3,
        name: '专业版',
        quota: 3000,
        price: 49.9,
        validity: 180,
        description: '适合日常批改',
        recommended: true
    },
    {
        id: 4,
        name: '永久版',
        quota: -1,
        price: 99,
        validity: -1,
        description: '无限次数使用'
    }
];

interface PurchasePageProps {
    onActivateClick?: () => void;
    onClose?: () => void;
}

export default function PurchasePage({ onActivateClick, onClose }: PurchasePageProps) {
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');

    const handleSelectPackage = (pkg: Package) => {
        setSelectedPackage(pkg);
        setShowPayment(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 font-display">
            <div className="max-w-md mx-auto">
                {/* 头部 */}
                <div className="mb-4">
                    <h1 className="text-xl font-black text-gray-900 mb-1">💳 购买额度</h1>
                    <p className="text-xs text-gray-500">选择适合您的套餐</p>
                </div>

                {/* 套餐列表 */}
                <div className="space-y-3 mb-6">
                    {packages.map(pkg => (
                        <div
                            key={pkg.id}
                            onClick={() => handleSelectPackage(pkg)}
                            className={`
                                rounded-xl p-4 shadow-card cursor-pointer transition-all
                                ${pkg.recommended
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-2 border-blue-400 relative overflow-hidden'
                                    : 'bg-white border border-gray-200 hover:border-blue-300'
                                }
                            `}
                        >
                            {/* 推荐角标 */}
                            {pkg.recommended && (
                                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 text-blue-700 text-[10px] rounded-full font-bold">
                                    ⭐ 推荐
                                </div>
                            )}

                            <div className="flex items-start justify-between mb-2">
                                <div className={pkg.recommended ? 'text-white' : ''}>
                                    <h3 className="text-sm font-bold">{pkg.name}</h3>
                                    <p className={`text-xs ${pkg.recommended ? 'text-white/70' : 'text-gray-500'}`}>
                                        {pkg.description}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-lg font-black ${pkg.recommended ? 'text-white' : 'text-blue-600'}`}>
                                        ¥{pkg.price}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${pkg.recommended
                                    ? 'bg-white/20 text-white'
                                    : pkg.id === 4
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {pkg.quota === -1 ? '无限次批改' : `${pkg.quota}次批改`}
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${pkg.recommended
                                    ? 'bg-white/20 text-white'
                                    : pkg.id === 4
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                    {pkg.validity === -1 ? '永久有效' : `${pkg.validity}天有效期`}
                                </span>
                            </div>

                            <button className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-colors ${pkg.recommended
                                ? 'bg-white text-blue-600 hover:bg-white/90'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                }`}>
                                选择此套餐
                            </button>
                        </div>
                    ))}
                </div>

                {/* 已有激活码按钮 */}
                {onActivateClick && (
                    <div className="text-center mb-6">
                        <button
                            onClick={() => {
                                onClose?.();
                                onActivateClick();
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">key</span>
                            已有激活码？点击输入
                        </button>
                    </div>
                )}

                {/* 支付弹窗 */}
                {showPayment && selectedPackage && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
                        onClick={() => setShowPayment(false)}
                    >
                        <div
                            className="bg-white rounded-xl p-4 shadow-float border border-gray-100 w-full max-w-md max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* 关闭按钮 */}
                            <button
                                onClick={() => setShowPayment(false)}
                                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <span className="material-symbols-outlined text-gray-400 text-[20px]">close</span>
                            </button>

                            {/* 订单信息 */}
                            <div className="pb-3 mb-3 border-b border-gray-100">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-gray-500">套餐</span>
                                    <span className="font-bold text-gray-800">{selectedPackage.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">金额</span>
                                    <span className="text-lg font-black text-blue-600">¥{selectedPackage.price}</span>
                                </div>
                            </div>

                            {/* 支付方式 */}
                            <h4 className="text-xs font-bold text-gray-700 mb-2">选择支付方式</h4>
                            <div className="space-y-2 mb-4">
                                <div
                                    onClick={() => setPaymentMethod('wechat')}
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'wechat'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                        微
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-gray-800">微信支付</div>
                                        <div className="text-[10px] text-gray-500">推荐使用</div>
                                    </div>
                                    {paymentMethod === 'wechat' && (
                                        <span className="material-symbols-outlined text-blue-600 text-[20px]">check_circle</span>
                                    )}
                                </div>

                                <div
                                    onClick={() => setPaymentMethod('alipay')}
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'alipay'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                        支
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-gray-800">支付宝</div>
                                        <div className="text-[10px] text-gray-500">扫码支付</div>
                                    </div>
                                    {paymentMethod === 'alipay' && (
                                        <span className="material-symbols-outlined text-blue-600 text-[20px]">check_circle</span>
                                    )}
                                </div>
                            </div>

                            {/* 二维码 */}
                            <div className="bg-gray-50 rounded-lg p-4 text-center mb-4">
                                <div className="w-32 h-32 mx-auto bg-white rounded-lg border-2 border-gray-200 flex items-center justify-center mb-2">
                                    <span className="material-symbols-outlined text-gray-300 text-[48px]">qr_code</span>
                                </div>
                                <p className="text-[10px] text-gray-500">
                                    打开{paymentMethod === 'wechat' ? '微信' : '支付宝'}扫一扫
                                </p>
                            </div>

                            {/* 说明 */}
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-orange-600 text-[16px] mt-0.5">info</span>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-orange-900 mb-3">支付后请联系客服获取激活码</p>

                                        {/* 左右布局：左侧说明，右侧二维码 - 垂直居中对齐 */}
                                        <div className="flex items-center gap-3">
                                            {/* 左侧：操作步骤 */}
                                            <div className="flex-1 text-xs text-orange-800 space-y-1.5">
                                                <p>1. 扫描右侧二维码添加客服</p>
                                                <p>2. 发送支付截图</p>
                                                <p>3. 获取激活码并充值</p>
                                            </div>

                                            {/* 右侧：微信二维码占位符 (较小) */}
                                            <div className="flex-shrink-0">
                                                <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                                                    <div className="text-center">
                                                        <span className="material-symbols-outlined text-gray-400 text-[24px]">qr_code_2</span>
                                                        <p className="text-[8px] text-gray-500 mt-0.5">客服微信</p>
                                                    </div>
                                                </div>
                                                <p className="text-[8px] text-gray-500 text-center mt-1">扫码添加</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
