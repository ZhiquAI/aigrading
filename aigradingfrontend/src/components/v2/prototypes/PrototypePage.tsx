/**
 * PrototypePage - 原型预览页面
 * 用于测试各种 UI 原型组件
 */
import React, { useState } from 'react';
import QuickEditDemo from './QuickEditDemo';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function PrototypePage() {
    const [showDemo, setShowDemo] = useState(true);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
            {/* 标题 */}
            <div className="max-w-md mx-auto mb-6">
                <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    UI 原型实验室
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                    在这里测试新的 UI 组件和交互模式
                </p>
            </div>

            {/* 原型展示区 */}
            <div className="max-w-md mx-auto space-y-6">
                {/* QuickEditDemo */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-bold text-slate-700">
                            📝 内联编辑原型 (react-easy-edit)
                        </h2>
                        <button
                            onClick={() => setShowDemo(!showDemo)}
                            className="text-xs text-indigo-500 hover:text-indigo-700"
                        >
                            {showDemo ? '收起' : '展开'}
                        </button>
                    </div>

                    {showDemo && <QuickEditDemo />}
                </div>

                {/* 使用说明 */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-600 mb-2">💡 使用说明</h3>
                    <ul className="text-[10px] text-slate-500 space-y-1">
                        <li>• 点击<strong>得分点名称</strong>可以直接编辑</li>
                        <li>• 点击<strong>分值数字</strong>可以修改满分值</li>
                        <li>• 点击<strong>+添加</strong>可以新增关键词</li>
                        <li>• 悬停关键词显示删除按钮</li>
                        <li>• 编辑后按 <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[8px]">✓</kbd> 保存，<kbd className="px-1 py-0.5 bg-slate-100 rounded text-[8px]">✕</kbd> 取消</li>
                    </ul>
                </div>

                {/* 空间模拟说明 */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                    <h3 className="text-xs font-bold text-amber-700 mb-1">⚠️ 空间模拟</h3>
                    <p className="text-[10px] text-amber-600">
                        当前容器宽度 max-w-md (448px) 接近 Side Panel 实际宽度 (~400px)，
                        可以较真实地评估组件在紧凑空间下的表现。
                    </p>
                </div>
            </div>
        </div>
    );
}
