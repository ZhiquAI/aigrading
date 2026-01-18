/**
 * OnboardingGuide.tsx - 新手引导组件
 * 
 * 首次使用时展示引导流程，帮助用户快速上手
 */

import React, { useState, useEffect } from 'react';
import {
    X, ChevronRight, ChevronLeft, Check,
    Settings, Key, BookOpen, Zap, Bot,
    ScanLine, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from './ui';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: {
        label: string;
        onClick?: () => void;
    };
}

interface OnboardingGuideProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    onOpenSettings?: () => void;
    onOpenRubric?: () => void;
}

const STORAGE_KEY = 'onboarding_completed';

// 检查是否需要显示引导
export function shouldShowOnboarding(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'true';
    } catch {
        return true;
    }
}

// 标记引导已完成
export function markOnboardingComplete(): void {
    try {
        localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
        // ignore
    }
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
    isOpen,
    onClose,
    onComplete,
    onOpenSettings,
    onOpenRubric
}) => {
    const [currentStep, setCurrentStep] = useState(0);

    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: '欢迎使用 AI 智能批改助手',
            description: '让我们用 3 步快速上手，体验 AI 辅助阅卷的高效便捷！',
            icon: <Sparkles className="w-12 h-12 text-blue-500" />
        },
        {
            id: 'api-key',
            title: '第 1 步：配置 API 密钥',
            description: '在「设置」中配置您的 AI 服务密钥（Gemini/OpenAI/智谱），这是使用批改功能的前提。',
            icon: <Key className="w-12 h-12 text-green-500" />,
            action: {
                label: '前往设置',
                onClick: onOpenSettings
            }
        },
        {
            id: 'rubric',
            title: '第 2 步：配置评分细则',
            description: '上传试题或答案图片，AI 会自动生成评分标准。您也可以手动编辑细则。',
            icon: <BookOpen className="w-12 h-12 text-purple-500" />,
            action: {
                label: '配置评分细则',
                onClick: onOpenRubric
            }
        },
        {
            id: 'grading',
            title: '第 3 步：开始批改',
            description: '选择「辅助模式」查看 AI 建议后确认，或选择「自动模式」全自动批改。',
            icon: <Bot className="w-12 h-12 text-orange-500" />
        },
        {
            id: 'complete',
            title: '准备就绪！',
            description: '您已了解基本操作。打开阅卷平台（智学网/好分数等），开始体验 AI 批改吧！',
            icon: <Check className="w-12 h-12 text-green-500" />
        }
    ];

    const currentStepData = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;

    const handleNext = () => {
        if (isLastStep) {
            markOnboardingComplete();
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        markOnboardingComplete();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* 进度指示器 */}
                <div className="flex gap-1 p-3 bg-gray-50">
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`flex-1 h-1 rounded-full transition-all duration-300 ${idx <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>

                {/* 内容区 */}
                <div className="p-6 text-center">
                    {/* 图标 */}
                    <div className="mb-4 flex justify-center">
                        <div className="p-4 bg-gray-50 rounded-2xl">
                            {currentStepData.icon}
                        </div>
                    </div>

                    {/* 标题 */}
                    <h2 className="text-xl font-bold text-gray-800 mb-2">
                        {currentStepData.title}
                    </h2>

                    {/* 描述 */}
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        {currentStepData.description}
                    </p>

                    {/* 操作按钮 */}
                    {currentStepData.action && (
                        <button
                            onClick={() => {
                                currentStepData.action?.onClick?.();
                                handleNext();
                            }}
                            className="mb-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 mx-auto"
                        >
                            {currentStepData.action.label}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* 底部导航 */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                    {/* 左侧：跳过/上一步 */}
                    <div>
                        {isFirstStep ? (
                            <button
                                onClick={handleSkip}
                                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                跳过引导
                            </button>
                        ) : (
                            <button
                                onClick={handlePrev}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                上一步
                            </button>
                        )}
                    </div>

                    {/* 右侧：下一步/完成 */}
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleNext}
                        icon={isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    >
                        {isLastStep ? '开始使用' : '下一步'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingGuide;
