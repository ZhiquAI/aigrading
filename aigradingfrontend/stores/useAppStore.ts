/**
 * useAppStore.ts - Zustand 全局状态管理
 * 
 * 集中管理应用核心状态，解决 Props Drilling 问题
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Tab, AppConfig } from '../types';
import { GradingStrategy } from '../services/geminiService';
import { storage } from '../utils/storage';

// ==================== 状态类型定义 ====================

interface ConfiguredQuestion {
    key: string;
    questionNo: string;
    platform: string;
}

interface AppState {
    // === 导航状态 ===
    activeTab: Tab;

    // === 评分细则状态 ===
    isRubricConfigured: boolean;
    rubricContent: string;
    detectedQuestionKey: string | null;
    manualQuestionKey: string | null;
    configuredQuestions: ConfiguredQuestion[];
    isRubricDrawerOpen: boolean;

    // === 批改策略 ===
    gradingStrategy: GradingStrategy;

    // === 计算属性 ===
    readonly currentQuestionKey: string | null;
}

interface AppActions {
    // === 导航操作 ===
    setActiveTab: (tab: Tab) => void;

    // === 评分细则操作 ===
    setIsRubricConfigured: (configured: boolean) => void;
    setRubricContent: (content: string) => void;
    setDetectedQuestionKey: (key: string | null) => void;
    setManualQuestionKey: (key: string | null) => void;
    setConfiguredQuestions: (questions: ConfiguredQuestion[]) => void;
    setIsRubricDrawerOpen: (open: boolean) => void;

    // === 批改策略操作 ===
    setGradingStrategy: (strategy: GradingStrategy) => void;

    // === 复合操作 ===
    saveRubric: (content: string, questionKey?: string) => Promise<void>;
    loadRubricForQuestion: (questionKey: string) => Promise<void>;
    loadConfiguredQuestions: () => Promise<void>;

    // === 重置操作 ===
    reset: () => void;
}

type AppStore = AppState & AppActions;

// ==================== 初始状态 ====================

const initialState: AppState = {
    activeTab: Tab.Grading,
    isRubricConfigured: false,
    rubricContent: '',
    detectedQuestionKey: null,
    manualQuestionKey: null,
    configuredQuestions: [],
    isRubricDrawerOpen: false,
    gradingStrategy: 'pro',
    get currentQuestionKey() {
        return this.manualQuestionKey || this.detectedQuestionKey;
    }
};

// ==================== Store 创建 ====================

export const useAppStore = create<AppStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            // 计算属性 getter
            get currentQuestionKey() {
                const state = get();
                return state.manualQuestionKey || state.detectedQuestionKey;
            },

            // === 导航操作 ===
            setActiveTab: (tab) => set({ activeTab: tab, isRubricDrawerOpen: false }),

            // === 评分细则操作 ===
            setIsRubricConfigured: (configured) => set({ isRubricConfigured: configured }),
            setRubricContent: (content) => set({ rubricContent: content }),
            setDetectedQuestionKey: (key) => set({ detectedQuestionKey: key }),
            setManualQuestionKey: (key) => set({ manualQuestionKey: key }),
            setConfiguredQuestions: (questions) => set({ configuredQuestions: questions }),
            setIsRubricDrawerOpen: (open) => set({ isRubricDrawerOpen: open }),

            // === 批改策略操作 ===
            setGradingStrategy: (strategy) => {
                set({ gradingStrategy: strategy });
                storage.setItem('app_grading_strategy', strategy);
            },

            // === 复合操作 ===
            saveRubric: async (content, questionKey) => {
                const state = get();
                const qk = questionKey || state.manualQuestionKey || state.detectedQuestionKey;

                if (!content.trim()) {
                    console.warn('[AppStore] Attempted to save empty rubric');
                    return;
                }

                const storageKey = qk ? `app_rubric_content:${qk}` : 'app_rubric_content';
                await storage.setItem(storageKey, content);

                set({
                    rubricContent: content,
                    isRubricConfigured: true,
                    isRubricDrawerOpen: false,
                    ...(qk ? { manualQuestionKey: qk } : {})
                });

                console.log('[AppStore] Rubric saved locally:', { storageKey, length: content.length });

                // 刷新已配置题目列表
                get().loadConfiguredQuestions();

                // 异步同步到后端（不阻塞 UI）
                if (qk) {
                    import('../services/proxyService').then(({ saveRubricToServer }) => {
                        saveRubricToServer(qk, content).catch(err => {
                            console.warn('[AppStore] 后端同步失败，仅保存本地:', err);
                        });
                    });
                }
            },

            loadRubricForQuestion: async (questionKey) => {
                if (!questionKey) {
                    set({ rubricContent: '', isRubricConfigured: false });
                    return;
                }

                const storageKey = `app_rubric_content:${questionKey}`;

                // 1. 先从本地加载（快速响应）
                const localRubric = await storage.getItem(storageKey);

                if (localRubric && localRubric.trim()) {
                    set({ rubricContent: localRubric, isRubricConfigured: true });
                    console.log('[AppStore] Rubric loaded from local:', { storageKey });
                    return;
                }

                // 2. 本地没有，尝试从后端加载
                try {
                    const { loadRubricFromServer } = await import('../services/proxyService');
                    const serverRubric = await loadRubricFromServer(questionKey);

                    if (serverRubric && serverRubric.trim()) {
                        // 缓存到本地
                        await storage.setItem(storageKey, serverRubric);
                        set({ rubricContent: serverRubric, isRubricConfigured: true });
                        console.log('[AppStore] Rubric loaded from server and cached:', { storageKey });
                        return;
                    }
                } catch (err) {
                    console.warn('[AppStore] 从后端加载评分细则失败:', err);
                }

                // 3. 本地和后端都没有
                set({ rubricContent: '', isRubricConfigured: false });
                console.log('[AppStore] No rubric found:', { storageKey });
            },

            loadConfiguredQuestions: async () => {
                try {
                    // 1. 获取本地数据
                    const localQuestions: ConfiguredQuestion[] = [];
                    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                        const items = await new Promise<Record<string, unknown>>((resolve) => {
                            chrome.storage.local.get(null, resolve);
                        });

                        for (const key of Object.keys(items)) {
                            if (key.startsWith('app_rubric_content:')) {
                                const value = items[key];
                                if (typeof value === 'string' && value.trim()) {
                                    const parts = key.replace('app_rubric_content:', '').split(':');
                                    const platform = parts[0] || '未知';
                                    const questionNo = parts[parts.length - 1] || '未知';
                                    localQuestions.push({ key, questionNo, platform });
                                }
                            }
                        }
                    }

                    // 2. 获取后端数据
                    let serverQuestions: ConfiguredQuestion[] = [];
                    try {
                        const { loadAllRubricsFromServer } = await import('../services/proxyService');
                        const serverRubrics = await loadAllRubricsFromServer();

                        serverQuestions = serverRubrics.map(r => {
                            const key = `app_rubric_content:${r.questionKey}`;
                            const parts = r.questionKey.split(':');
                            const platform = parts[0] || '未知';
                            const questionNo = parts[parts.length - 1] || '未知';
                            return { key, questionNo, platform };
                        });

                        // 3. 将后端有但本地没有的数据同步到本地（可选，为了离线访问）
                        // 注意：这里只缓存了元数据id，内容需要懒加载
                        // 实际上，如果想完全同步，应该把内容也写进去。
                        // 但为了性能，这里我们只更新列表，点击时通过 loadRubricForQuestion 加载内容
                    } catch (err) {
                        console.warn('[AppStore] Failed to load from server:', err);
                    }

                    // 4. 合并并去重
                    const questionMap = new Map<string, ConfiguredQuestion>();

                    // 先放本地
                    localQuestions.forEach(q => questionMap.set(q.key, q));

                    // 再放后端（如果想以后端为准，可以覆盖；或者只添加不存在的）
                    // 这里我们只添加本地不存在的，内容在点击时加载
                    serverQuestions.forEach(q => {
                        if (!questionMap.has(q.key)) {
                            questionMap.set(q.key, q);
                        }
                    });

                    const allQuestions = Array.from(questionMap.values());

                    // 按题号排序
                    allQuestions.sort((a, b) => (parseInt(a.questionNo) || 0) - (parseInt(b.questionNo) || 0));
                    set({ configuredQuestions: allQuestions });

                } catch (e) {
                    console.error('[AppStore] Error loading configured questions:', e);
                }
            },

            // === 重置操作 ===
            reset: () => set({
                ...initialState,
                get currentQuestionKey() {
                    return this.manualQuestionKey || this.detectedQuestionKey;
                }
            })
        }),
        {
            name: 'app-store', // localStorage key
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // 只持久化需要保存的状态
                gradingStrategy: state.gradingStrategy,
                activeTab: state.activeTab
            })
        }
    )
);

// ==================== 选择器 Hooks ====================

// 获取当前题目 Key
export const useCurrentQuestionKey = () => useAppStore((state) =>
    state.manualQuestionKey || state.detectedQuestionKey
);

// 获取评分细则状态
export const useRubricState = () => useAppStore((state) => ({
    isConfigured: state.isRubricConfigured,
    content: state.rubricContent,
    questionKey: state.manualQuestionKey || state.detectedQuestionKey
}));

// 获取导航状态
export const useNavigation = () => useAppStore((state) => ({
    activeTab: state.activeTab,
    setActiveTab: state.setActiveTab
}));

export default useAppStore;
