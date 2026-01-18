/**
 * ModeSelector.tsx - 批改模式选择器
 * 
 * 从 GradingView.tsx 拆分
 * 提供辅助模式和自动模式的切换 UI
 */

import React from 'react';
import { Bot, Zap, Play, Square, Pause, RotateCcw } from 'lucide-react';

export type GradingMode = 'manual' | 'auto';

interface ModeSelectorProps {
    mode: GradingMode;
    isRunning: boolean;
    isPaused?: boolean;
    isRubricConfigured: boolean;
    onStartAssist: () => void;
    onStopAssist: () => void;
    onStartAuto: () => void;
    onStopAuto: () => void;
    onPause?: () => void;
    onResume?: () => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
    mode,
    isRunning,
    isPaused = false,
    isRubricConfigured,
    onStartAssist,
    onStopAssist,
    onStartAuto,
    onStopAuto,
    onPause,
    onResume
}) => {
    return (
        <div className="grid grid-cols-2 gap-3">
            {/* 辅助模式卡片 */}
            <div
                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${mode === 'manual'
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-gray-200 hover:border-blue-300 bg-white'
                    }`}
            >
                <div className="flex items-center gap-2 mb-2">
                    <Bot className={`w-5 h-5 ${mode === 'manual' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-bold ${mode === 'manual' ? 'text-blue-700' : 'text-gray-700'}`}>
                        辅助模式
                    </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">AI 打分建议，人工确认提交</p>

                {mode === 'manual' && (
                    <button
                        onClick={isRunning ? onStopAssist : onStartAssist}
                        disabled={!isRubricConfigured && !isRunning}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isRunning
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : isRubricConfigured
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isRunning ? (
                            <>
                                <Square className="w-4 h-4" />
                                停止
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                开始辅助
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* 自动模式卡片 */}
            <div
                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${mode === 'auto'
                        ? 'border-green-500 bg-green-50/50'
                        : 'border-gray-200 hover:border-green-300 bg-white'
                    }`}
            >
                <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-5 h-5 ${mode === 'auto' ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={`font-bold ${mode === 'auto' ? 'text-green-700' : 'text-gray-700'}`}>
                        自动模式
                    </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">AI 全自动批改并提交</p>

                {mode === 'auto' && (
                    <div className="flex gap-2">
                        {isRunning ? (
                            <>
                                {isPaused ? (
                                    <button
                                        onClick={onResume}
                                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                                    >
                                        <Play className="w-4 h-4" />
                                        继续
                                    </button>
                                ) : (
                                    <button
                                        onClick={onPause}
                                        className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                                    >
                                        <Pause className="w-4 h-4" />
                                        暂停
                                    </button>
                                )}
                                <button
                                    onClick={onStopAuto}
                                    className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                                >
                                    <Square className="w-4 h-4" />
                                    停止
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onStartAuto}
                                disabled={!isRubricConfigured}
                                className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isRubricConfigured
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Play className="w-4 h-4" />
                                开始自动
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModeSelector;
