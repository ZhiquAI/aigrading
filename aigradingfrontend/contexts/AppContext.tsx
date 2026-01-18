/**
 * 全局应用状态管理
 * 集中管理评分细则、题目、策略等核心状态
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { GradingStrategy } from '../services/geminiService';
import { storage } from '../utils/storage';

// ============ Types ============

interface ConfiguredQuestion {
    key: string;
    questionNo: string;
    platform: string;
}

interface AppState {
    // 评分细则
    isRubricConfigured: boolean;
    rubricContent: string;

    // 题目
    currentQuestionKey: string | null;
    configuredQuestions: ConfiguredQuestion[];

    // 策略
    gradingStrategy: GradingStrategy;

    // UI 状态
    isRubricDrawerOpen: boolean;
}

interface AppActions {
    // 评分细则
    setRubricContent: (content: string) => void;
    saveRubric: (content: string) => Promise<void>;

    // 题目
    setCurrentQuestionKey: (key: string | null) => void;
    refreshConfiguredQuestions: () => Promise<void>;

    // 策略
    setGradingStrategy: (strategy: GradingStrategy) => Promise<void>;

    // UI
    openRubricDrawer: () => void;
    closeRubricDrawer: () => void;
}

type AppContextType = AppState & AppActions;

// ============ Context ============

const AppContext = createContext<AppContextType | null>(null);

// ============ Hook ============

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};

// ============ Provider ============

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    // 评分细则状态
    const [isRubricConfigured, setIsRubricConfigured] = useState(false);
    const [rubricContent, setRubricContent] = useState('');

    // 题目状态
    const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);
    const [configuredQuestions, setConfiguredQuestions] = useState<ConfiguredQuestion[]>([]);

    // 策略状态
    const [gradingStrategy, setGradingStrategyState] = useState<GradingStrategy>('pro');

    // UI 状态
    const [isRubricDrawerOpen, setIsRubricDrawerOpen] = useState(false);

    // ============ Storage Key Helper ============

    const getRubricStorageKey = (questionKey: string) => `app_rubric_content:${questionKey}`;

    // ============ 初始化加载 ============

    useEffect(() => {
        const loadInitialData = async () => {
            // 加载策略
            const savedStrategy = await storage.getItem('app_grading_strategy');
            if (savedStrategy) {
                // 兼容旧值
                if (savedStrategy === 'gpt4' || savedStrategy === 'dual') {
                    setGradingStrategyState('pro');
                } else if (savedStrategy === 'gemini') {
                    setGradingStrategyState('flash');
                } else {
                    setGradingStrategyState(savedStrategy as GradingStrategy);
                }
            }

            // 加载全局评分细则（兼容旧数据）
            const savedRubric = await storage.getItem('app_rubric_content');
            if (savedRubric) {
                setRubricContent(savedRubric);
                setIsRubricConfigured(true);
            }
        };

        loadInitialData();
    }, []);

    // ============ 题目切换时加载评分细则 ============

    useEffect(() => {
        const loadRubricForQuestion = async () => {
            if (!currentQuestionKey) return;

            const key = getRubricStorageKey(currentQuestionKey);
            const rubric = await storage.getItem(key);

            if (rubric && rubric.trim()) {
                setRubricContent(rubric);
                setIsRubricConfigured(true);
            } else {
                setRubricContent('');
                setIsRubricConfigured(false);
            }
        };

        loadRubricForQuestion();
    }, [currentQuestionKey]);

    // ============ Actions ============

    const saveRubric = useCallback(async (content: string) => {
        if (!content.trim()) return;

        setRubricContent(content);
        setIsRubricConfigured(true);

        const key = currentQuestionKey
            ? getRubricStorageKey(currentQuestionKey)
            : 'app_rubric_content';

        await storage.setItem(key, content);
        setIsRubricDrawerOpen(false);

        // 刷新题目列表
        await refreshConfiguredQuestions();
    }, [currentQuestionKey]);

    const refreshConfiguredQuestions = useCallback(async () => {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

            chrome.storage.local.get(null, (items: Record<string, unknown>) => {
                const questions: ConfiguredQuestion[] = [];

                for (const key of Object.keys(items)) {
                    if (key.startsWith('app_rubric_content:')) {
                        const value = items[key];
                        if (typeof value === 'string' && value.trim()) {
                            const parts = key.replace('app_rubric_content:', '').split(':');
                            const platform = parts[0] || '未知';
                            const questionNo = parts[parts.length - 1] || '未知';
                            questions.push({ key, questionNo, platform });
                        }
                    }
                }

                questions.sort((a, b) => (parseInt(a.questionNo) || 0) - (parseInt(b.questionNo) || 0));
                setConfiguredQuestions(questions);
            });
        } catch (e) {
            console.error('[AppContext] Error loading configured questions:', e);
        }
    }, []);

    const setGradingStrategy = useCallback(async (strategy: GradingStrategy) => {
        setGradingStrategyState(strategy);
        await storage.setItem('app_grading_strategy', strategy);
    }, []);

    const openRubricDrawer = useCallback(() => setIsRubricDrawerOpen(true), []);
    const closeRubricDrawer = useCallback(() => setIsRubricDrawerOpen(false), []);

    // ============ Context Value ============

    const value: AppContextType = {
        // State
        isRubricConfigured,
        rubricContent,
        currentQuestionKey,
        configuredQuestions,
        gradingStrategy,
        isRubricDrawerOpen,

        // Actions
        setRubricContent,
        saveRubric,
        setCurrentQuestionKey,
        refreshConfiguredQuestions,
        setGradingStrategy,
        openRubricDrawer,
        closeRubricDrawer,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export default AppContext;
