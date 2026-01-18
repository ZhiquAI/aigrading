'use client';

import { useState } from 'react';

const plans = [
    { id: 'basic', name: '基础', quota: 1000, price: 9.9, originalPrice: 9.9, discount: null },
    { id: 'standard', name: '标准', quota: 2000, price: 17.8, originalPrice: 19.8, discount: '9折' },
    { id: 'pro', name: '专业', quota: 3000, price: 23.8, originalPrice: 29.7, discount: '8折', popular: true },
];

export default function PayPage() {
    const [selectedPlan, setSelectedPlan] = useState('pro');
    const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');

    const currentPlan = plans.find(p => p.id === selectedPlan)!;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Logo - 左上角 */}
                <div className="flex items-center gap-2 mb-10">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-base">智</span>
                    </div>
                    <span className="text-slate-400 text-sm">智阅AI</span>
                </div>

                {/* 标题 - 居中 */}
                <div className="text-center mb-10">
                    <h1 className="text-2xl font-bold text-white mb-2">购买配额</h1>
                    <p className="text-slate-400 text-sm">选择适合你的套餐</p>
                </div>

                {/* 套餐选择 - 简洁卡片 */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 p-2 mb-8">
                    <div className="grid grid-cols-3 gap-2">
                        {plans.map((plan, index) => (
                            <button
                                key={plan.id}
                                onClick={() => setSelectedPlan(plan.id)}
                                className={`relative py-10 px-6 rounded-xl transition-all ${selectedPlan === plan.id
                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                                    : 'hover:bg-slate-700/50 text-slate-300'
                                    }`}
                            >
                                {plan.popular && (
                                    <span className={`absolute -top-2 right-3 px-3 py-1 text-xs font-medium rounded-full ${selectedPlan === plan.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-purple-500/20 text-purple-400'
                                        }`}>
                                        最受欢迎
                                    </span>
                                )}
                                <div className="text-center">
                                    <p className={`text-sm mb-2 ${selectedPlan === plan.id ? 'text-white/70' : 'text-slate-500'}`}>
                                        {index + 1}
                                    </p>
                                    <h3 className="text-lg font-semibold mb-3">{plan.name}</h3>
                                    <p className="text-3xl font-bold mb-2">
                                        ¥{plan.price}
                                        {plan.discount && (
                                            <span className={`ml-2 text-sm font-normal ${selectedPlan === plan.id ? 'text-white/70' : 'text-slate-500'
                                                }`}>
                                                {plan.originalPrice !== plan.price && `¥${plan.originalPrice}`}
                                            </span>
                                        )}
                                    </p>
                                    <p className={`text-base ${selectedPlan === plan.id ? 'text-white/80' : 'text-slate-400'}`}>
                                        {plan.quota}次
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 支付区域 */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 p-6 mb-6">
                    {/* Tab 切换 */}
                    <div className="flex justify-center gap-2 mb-6">
                        <button
                            onClick={() => setPayMethod('wechat')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${payMethod === 'wechat'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'text-slate-400 hover:text-slate-300 border border-transparent'
                                }`}
                        >
                            💬 微信支付
                        </button>
                        <button
                            onClick={() => setPayMethod('alipay')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${payMethod === 'alipay'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-400 hover:text-slate-300 border border-transparent'
                                }`}
                        >
                            💳 支付宝
                        </button>
                    </div>

                    {/* 二维码 */}
                    <div className="flex justify-center mb-4">
                        <div className="w-48 h-48 bg-white rounded-xl overflow-hidden shadow-lg flex items-center justify-center">
                            <img
                                src={payMethod === 'wechat' ? '/wechat-pay.jpg' : '/alipay.jpg'}
                                alt={payMethod === 'wechat' ? '微信支付' : '支付宝'}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>

                    {/* 金额 */}
                    <p className="text-center text-3xl font-bold text-white mb-2">
                        ¥{currentPlan.price}
                    </p>
                    <p className="text-center text-slate-400 text-xs">
                        请使用{payMethod === 'wechat' ? '微信' : '支付宝'}扫描二维码完成支付
                    </p>
                </div>

                {/* 简化说明 */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                    <p className="text-amber-400 text-sm text-center">
                        <span className="font-medium">💡 付款时请备注：</span>激活码+你的微信号
                        <br />
                        <span className="text-amber-400/70 text-xs">付款后24小时内通过微信发送激活码</span>
                    </p>
                </div>

                {/* 联系方式 */}
                <div className="text-center text-slate-500 text-xs">
                    <p>如有问题，请联系客服微信：<span className="text-slate-300 font-medium">ZhiquAI</span></p>
                </div>
            </div>
        </main>
    );
}
