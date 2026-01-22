/**
 * PrivacyPolicy.tsx - 隐私政策组件
 * 
 * 显示应用的隐私政策和数据使用说明
 */

import React from 'react';
import { X, Shield, Database, Eye, Trash2, ExternalLink } from 'lucide-react';
import { Button } from './ui';

interface PrivacyPolicyProps {
    isOpen: boolean;
    onClose: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-800">隐私政策</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/50 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 数据收集 */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-green-600" />
                            <h3 className="font-bold text-gray-800">数据收集</h3>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                            <ul className="text-sm text-gray-700 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span><strong>本地存储</strong>：所有批改数据仅存储在您的浏览器本地，不会上传到任何服务器</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span><strong>加密保护</strong>：API Key 等敏感信息经过加密后存储</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span><strong>无账户系统</strong>：本应用不需要注册账户，不收集个人身份信息</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* 数据使用 */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Eye className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-gray-800">数据使用</h3>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <ul className="text-sm text-gray-700 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    <span><strong>AI 批改</strong>：答题卡图片仅在批改时发送给您配置的 AI 服务（Gemini/OpenAI/智谱）</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    <span><strong>临时处理</strong>：图片数据仅用于即时批改，不会在 AI 服务端长期保存</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    <span><strong>本地历史</strong>：批改结果保存在本地，方便您查看和导出</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* 数据删除 */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Trash2 className="w-4 h-4 text-red-600" />
                            <h3 className="font-bold text-gray-800">数据删除</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <p className="text-sm text-gray-700 mb-3">您可以随时删除本地存储的所有数据：</p>
                            <ul className="text-sm text-gray-600 space-y-1.5">
                                <li>1. 在「历史记录」中删除单条或全部记录</li>
                                <li>2. 在「设置」中重置 API Key 配置</li>
                                <li>3. 在浏览器设置中清除扩展数据</li>
                            </ul>
                        </div>
                    </section>

                    {/* 第三方服务 */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <ExternalLink className="w-4 h-4 text-purple-600" />
                            <h3 className="font-bold text-gray-800">第三方服务</h3>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <p className="text-sm text-gray-700 mb-2">本应用可能使用以下第三方 AI 服务：</p>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Google Gemini API</li>
                                <li>• OpenAI API（兼容接口）</li>
                                <li>• 智谱 AI API</li>
                            </ul>
                            <p className="text-xs text-gray-500 mt-2">
                                请参阅各服务商的隐私政策了解其数据处理方式
                            </p>
                        </div>
                    </section>

                    {/* 更新日期 */}
                    <div className="text-center text-xs text-gray-400 pt-2">
                        最后更新：2026 年 1 月
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={onClose}
                        className="w-full"
                    >
                        我已了解
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
