'use client';

import { useState } from 'react';

export default function SettingsPage() {
    const [adminKey, setAdminKey] = useState('');
    const [notifyEmail, setNotifyEmail] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        // TODO: 保存配置
        setTimeout(() => {
            setSaving(false);
            alert('设置已保存');
        }, 500);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">系统设置</h1>

            <div className="space-y-6">
                {/* 安全设置 */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">安全设置</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-500 text-sm mb-2">
                                管理员密码
                            </label>
                            <input
                                type="password"
                                value={adminKey}
                                onChange={(e) => setAdminKey(e.target.value)}
                                placeholder="输入新密码（留空不修改）"
                                className="w-full max-w-md px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* 通知设置 */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">通知设置</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-500 text-sm mb-2">
                                通知邮箱
                            </label>
                            <input
                                type="email"
                                value={notifyEmail}
                                onChange={(e) => setNotifyEmail(e.target.value)}
                                placeholder="接收通知的邮箱地址"
                                className="w-full max-w-md px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-indigo-600" />
                                <span className="text-gray-600">API 故障时发送通知</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-indigo-600" />
                                <span className="text-gray-600">每日使用报告</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-indigo-600" />
                                <span className="text-gray-600">激活码库存不足提醒</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 保存按钮 */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
                >
                    {saving ? '保存中...' : '保存设置'}
                </button>
            </div>
        </div>
    );
}
