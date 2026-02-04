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
import { Exam } from '../services/proxyService';

// ==================== 状态类型定义 ====================

export interface HeaderAction {
    id: string;
    label: string;
    icon: string; // Lucide icon name like 'Download'
    onClick?: () => void;
    dropdown?: { label: string; onClick: () => void }[];
}

export interface AppTask {
    id: string;
    label: string;
    percent: number; // 0-100
    status: 'idle' | 'active' | 'success' | 'error';
    message?: string;
}

export interface HistoryRecord {
    id: string;
    questionNo?: string;
    questionKey?: string;
    score: number;
    maxScore: number;
    timestamp: number;
    comment?: string;
    breakdown?: { label: string; score: number; max: number; comment?: string }[];
    isHidden?: boolean;
}

interface ConfiguredQuestion {
    key: string;
    questionNo: string;
    platform: string;
    examId?: string | null;
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
    rubricLibrary: any[];
    rubricData: Record<string, any>;
    isRubricDrawerOpen: boolean;

    // === 考试管理状态 ===
    exams: Exam[];
    activeExamId: string | null;

    // === 批改策略 ===
    gradingStrategy: GradingStrategy;

    // === 计算属性 ===
    readonly currentQuestionKey: string | null;
    readonly isOfficial: boolean;

    // === V2 界面开关 ===
    showV2: boolean;

    // === V2 应用模式 ===
    appMode: 'enterprise' | 'personal';

    // === 阅卷模式 ===
    gradingMode: 'assist' | 'auto';

    // === 应用状态 (V2) ===
    status: 'idle' | 'scanning' | 'thinking' | 'result' | 'error';
    statusMessage: string;

    // === 历史记录 ===
    historyRecords: HistoryRecord[];
    isHistoryLoading: boolean;

    // === 账户/激活码状态 ===
    activationCode: string | null;
    hasSeenOnboarding: boolean;
    quota: {
        remaining: number;
        total: number;
        isPaid: boolean;
        lastSync: number;
        status: string;
    };

    // === 顶部导航栏动作 (不持久化) ===
    headerActions: HeaderAction[];

    // === 全局任务列表 (不持久化) ===
    tasks: AppTask[];

    // === 系统检测状态 ===
    health: {
        api: boolean | null;
        answerCard: boolean | null;
        lastUpdate: number;
    };

    // === 系统配置 (持久化) ===
    autoGradingInterval: number; // 自动阅卷等待时间 (ms)
}

interface AppActions {
    // === 导航操作 ===
    setActiveTab: (tab: Tab) => void;

    // === 模式切换 ===
    setAppMode: (mode: 'enterprise' | 'personal') => void;

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
    createRubricQuestion: (params: { questionNo: string; alias: string }) => void;
    selectQuestion: (id: string) => void;
    setRubricConfig: (id: string, config: any) => void;

    loadHistory: () => Promise<void>;
    addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'timestamp'>) => void;
    deleteHistoryRecord: (id: string, hardDelete?: boolean) => void;
    clearHistoryByQuestion: (questionKey: string) => void;

    // === 考试管理操作 ===
    loadExams: () => Promise<void>;
    createExamAction: (params: Partial<Exam>) => Promise<Exam | null>;
    updateExamAction: (id: string, params: Partial<Exam>) => Promise<Exam | null>;
    deleteExamAction: (id: string) => Promise<boolean>;
    setActiveExamId: (id: string | null) => void;

    // === 重置操作 ===
    reset: () => void;

    // === V2 操作 ===
    setShowV2: (show: boolean) => void;

    // === 阅卷模式 ===
    setGradingMode: (mode: 'assist' | 'auto') => void;
    setStatus: (status: AppState['status']) => void;

    // === 账户/激活码操作 ===
    setActivationCode: (code: string | null) => void;
    setHasSeenOnboarding: (seen: boolean) => void;
    syncQuota: () => Promise<void>;

    // === 顶部导航栏动作注册 ===
    setHeaderActions: (actions: HeaderAction[]) => void;

    // === 全局任务管理 ===
    addTask: (task: AppTask) => void;
    updateTask: (id: string, updates: Partial<AppTask> | ((prev: AppTask) => AppTask)) => void;
    removeTask: (id: string) => void;

    // === 系统检测状态操作 ===
    setHealth: (health: Partial<AppState['health']>) => void;

    // === 系统配置修改 ===
    setAutoGradingInterval: (interval: number) => void;
}

type AppStore = AppState & AppActions;

// ==================== 初始状态 ====================

const initialState: AppState = {
    activeTab: Tab.Rubric, // 默认为细则配置（工作流起点）
    isRubricConfigured: false,
    rubricContent: '',
    detectedQuestionKey: null,
    manualQuestionKey: null,
    configuredQuestions: [],
    isRubricDrawerOpen: false,
    gradingStrategy: 'pro',
    get currentQuestionKey() {
        return this.manualQuestionKey || this.detectedQuestionKey;
    },
    showV2: true, // 默认开启新版
    gradingMode: 'assist', // 默认辅助模式
    appMode: 'enterprise',
    status: 'idle',
    statusMessage: '准备就绪',
    historyRecords: [],
    isHistoryLoading: false,
    activationCode: null,
    hasSeenOnboarding: false,
    quota: {
        remaining: 0, // 初始为 0，触发生命周期同步
        total: 10,
        isPaid: false,
        lastSync: 0,
        status: 'active'
    },
    headerActions: [],
    tasks: [],
    health: {
        api: null,
        answerCard: null,
        lastUpdate: 0
    },
    autoGradingInterval: 3000,
    rubricLibrary: [],
    rubricData: {},
    exams: [],
    activeExamId: null,
    get isOfficial() {
        return this.activationCode !== null && this.quota.isPaid;
    }
};

// ==================== Store 创建 ====================

export const useAppStore = create<AppStore>()(
    persist<AppStore>(
        (set, get) => ({
            ...initialState,

            // 计算属性 getter
            get currentQuestionKey() {
                const state = get();
                return state.manualQuestionKey || state.detectedQuestionKey;
            },

            get isOfficial() {
                const state = get();
                // 暂时简单判断：如果有码且是付费状态
                return state.activationCode !== null && state.quota.isPaid;
            },

            // === 导航操作 ===
            setActiveTab: (tab) => set({ activeTab: tab, isRubricDrawerOpen: false }),

            // === 评分细则操作 ===
            setIsRubricConfigured: (configured) => set({ isRubricConfigured: configured }),
            setRubricContent: (content) => set({ rubricContent: content }),
            setDetectedQuestionKey: (key) => {
                set({ detectedQuestionKey: key });
                if (key) {
                    const state = get() as any;
                    if (!state.manualQuestionKey) {
                        state.loadRubricForQuestion(key);
                    }
                }
            },
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
                const state = get() as any;
                const qk = questionKey || state.manualQuestionKey || state.detectedQuestionKey;

                if (!content.trim()) {
                    console.warn('[AppStore] Attempted to save empty rubric');
                    return;
                }

                // --- 修复点：提取 examId 以便同步 ---
                let examId = null;
                try {
                    const parsed = JSON.parse(content);
                    examId = parsed.examId || null;
                } catch (e) {
                    console.warn('[AppStore] Failed to parse rubric content to extract examId');
                }

                const storageKey = qk ? `app_rubric_content:${qk}` : 'app_rubric_content';
                await storage.setItem(storageKey, content);

                set((state: any) => {
                    const parsedContent = JSON.parse(content);
                    const newRubricData = {
                        ...state.rubricData,
                        ...(qk ? { [qk]: parsedContent } : {})
                    };

                    const existsInLibrary = state.rubricLibrary.some((item: any) => item.id === qk);
                    let newRubricLibrary;

                    if (existsInLibrary) {
                        newRubricLibrary = state.rubricLibrary.map((item: any) =>
                            item.id === qk
                                ? {
                                    ...item,
                                    examId: examId,
                                    alias: parsedContent.title || item.alias,
                                    keywords: parsedContent.answerPoints ?
                                        (Array.from(new Set(parsedContent.answerPoints.slice(0, 3).flatMap((p: any) => p.keywords || []))) as string[]).slice(0, 5) :
                                        item.keywords
                                }
                                : item
                        );
                    } else {
                        newRubricLibrary = [
                            ...state.rubricLibrary,
                            {
                                id: qk,
                                questionNo: parsedContent.questionId || qk.split(':').pop(),
                                alias: parsedContent.title || '未命名',
                                keywords: [],
                                examId: examId,
                                isActive: true
                            }
                        ];
                    }

                    return {
                        rubricContent: content,
                        isRubricConfigured: true,
                        isRubricDrawerOpen: false,
                        ...(qk ? { manualQuestionKey: qk } : {}),
                        rubricData: newRubricData,
                        rubricLibrary: newRubricLibrary
                    };
                });

                console.log('[AppStore] Rubric saved locally:', { storageKey, length: content.length, examId });

                // 刷新已配置题目列表
                (get() as any).loadConfiguredQuestions();

                // 异步同步到后端（不阻塞 UI）- 仅正式会员
                if (qk && state.isOfficial) {
                    import('../services/proxyService').then(({ saveRubricToServer }) => {
                        saveRubricToServer(qk, content, examId).catch(err => {
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

                const state = get() as any;
                const storageKey = `app_rubric_content:${questionKey}`;

                // --- 优化点：缓存优先，消除闪烁 ---
                // 1. 检查内存缓存
                if (state.rubricData && state.rubricData[questionKey]) {
                    const cached = state.rubricData[questionKey];
                    const content = typeof cached === 'string' ? cached : JSON.stringify(cached, null, 2);
                    set({ rubricContent: content, isRubricConfigured: true });
                    console.log('[AppStore] Rubric loaded from memory cache:', { questionKey });
                    return;
                }

                // 2. 本地加载
                const localRubric = await storage.getItem(storageKey);
                if (localRubric && localRubric.trim()) {
                    set({
                        rubricContent: localRubric,
                        isRubricConfigured: true,
                        // 同步到内存缓存
                        rubricData: { ...state.rubricData, [questionKey]: JSON.parse(localRubric) }
                    });
                    console.log('[AppStore] Rubric loaded from local:', { storageKey });
                    return;
                }

                // 3. 后端加载
                if (state.isOfficial) {
                    try {
                        const { loadRubricFromServer } = await import('../services/proxyService');
                        const serverRubric = await loadRubricFromServer(questionKey);

                        if (serverRubric && serverRubric.trim()) {
                            await storage.setItem(storageKey, serverRubric);
                            set({
                                rubricContent: serverRubric,
                                isRubricConfigured: true,
                                rubricData: { ...state.rubricData, [questionKey]: JSON.parse(serverRubric) }
                            });
                            return;
                        }
                    } catch (err) {
                        console.warn('[AppStore] 从后端加载评分细则失败:', err);
                    }
                }

                // 4. 全部落空才重置
                set({ rubricContent: '', isRubricConfigured: false });
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

                                    // 尝试从内容中提取 examId
                                    let examId = null;
                                    try {
                                        const parsed = JSON.parse(value);
                                        examId = parsed.examId || (parsed as any).activeExamId || null;
                                    } catch (e) {
                                        // 容放：如果解析失败，尝试从现有的库中保留状态
                                        const existing = (get() as any).rubricLibrary?.find((i: any) => i.id === key.replace('app_rubric_content:', ''));
                                        examId = existing?.examId || null;
                                    }

                                    localQuestions.push({ key, questionNo, platform, examId });
                                }
                            }
                        }
                    } else {
                        // Fallback for localStorage (development environment)
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('app_rubric_content:')) {
                                const value = localStorage.getItem(key);
                                if (typeof value === 'string' && value.trim()) {
                                    const parts = key.replace('app_rubric_content:', '').split(':');
                                    const platform = parts[0] || '未知';
                                    const questionNo = parts[parts.length - 1] || '未知';

                                    let examId = null;
                                    try {
                                        const parsed = JSON.parse(value);
                                        examId = parsed.examId || (parsed as any).activeExamId || null;
                                    } catch (e) {
                                        const existing = (get() as any).rubricLibrary?.find((i: any) => i.id === key.replace('app_rubric_content:', ''));
                                        examId = existing?.examId || null;
                                    }

                                    localQuestions.push({ key, questionNo, platform, examId });
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
                            return { key, questionNo, platform, examId: r.examId };
                        });
                    } catch (err) {
                        console.warn('[AppStore] Failed to load from server:', err);
                    }

                    // 4. 合并并去重
                    const questionMap = new Map<string, ConfiguredQuestion>();

                    serverQuestions.forEach(q => questionMap.set(q.key, q));

                    localQuestions.forEach(q => {
                        if (!questionMap.has(q.key)) {
                            questionMap.set(q.key, q);
                        } else {
                            const existing = questionMap.get(q.key)!;
                            if (!existing.examId && q.examId) {
                                existing.examId = q.examId;
                            }
                        }
                    });

                    const allQuestions = Array.from(questionMap.values());

                    // 按题号排序
                    allQuestions.sort((a, b) => (parseInt(a.questionNo) || 0) - (parseInt(b.questionNo) || 0));

                    const currentRubricData = (get() as any).rubricData || {};

                    const libraryItems = allQuestions.map(q => {
                        const qk = q.key.replace('app_rubric_content:', '');
                        const storedData = currentRubricData[qk];

                        let alias = q.platform === 'manual' ? '手动配置题目' : `${q.platform} 平台题目`;
                        let keywords: string[] = [];

                        // 优先从 rubricData 中提取最新的元数据
                        if (storedData) {
                            // --- 适配 v2.0 格式 ---
                            if (storedData.title) alias = storedData.title; // v2.0 使用 title 作为别名
                            else if (storedData.alias) alias = storedData.alias; // 兼容旧版

                            // 提取关键词
                            if (Array.isArray(storedData.anchorKeywords) && storedData.anchorKeywords.length > 0) {
                                keywords = storedData.anchorKeywords;
                            } else if (Array.isArray(storedData.answerPoints)) {
                                // v2.0 格式：从 answerPoints 提取
                                keywords = (Array.from(new Set(storedData.answerPoints.slice(0, 3).flatMap((p: any) => p.keywords || []))) as string[]).slice(0, 5);
                            } else if (Array.isArray(storedData.points)) {
                                // 兼容旧版格式
                                keywords = (Array.from(new Set(storedData.points.slice(0, 3).flatMap((p: any) => p.keywords || []))) as string[]).slice(0, 5);
                            }
                        }

                        return {
                            id: qk,
                            questionNo: q.questionNo,
                            alias,
                            keywords,
                            examId: q.examId || (storedData as any)?.examId || null,
                            isActive: qk === ((get() as any).manualQuestionKey || (get() as any).detectedQuestionKey)
                        };
                    });

                    set({ configuredQuestions: allQuestions, rubricLibrary: libraryItems });

                } catch (e) {
                    console.error('[AppStore] Error loading configured questions:', e);
                }
            },

            createRubricQuestion: (params) => {
                const id = `manual:${params.questionNo}`;
                const activeExamId = (get() as any).activeExamId;
                const newRubric = {
                    id,
                    questionNo: params.questionNo,
                    alias: params.alias,
                    keywords: [],
                    examId: activeExamId,
                    isActive: true
                };

                set((state) => ({
                    rubricLibrary: [...state.rubricLibrary.filter(r => r.id !== id), newRubric],
                    manualQuestionKey: id,
                    isRubricConfigured: false,
                    rubricContent: ''
                }));
            },

            selectQuestion: (id) => {
                set({ manualQuestionKey: id });
                (get() as any).loadRubricForQuestion(id);
            },

            setRubricConfig: (id, config) => {
                set((state) => ({
                    rubricData: {
                        ...state.rubricData,
                        [id]: config
                    }
                }));
            },

            // === 重置操作 ===
            reset: () => set({
                ...initialState,
                get currentQuestionKey() {
                    return this.manualQuestionKey || this.detectedQuestionKey;
                }
            }),

            setShowV2: (show) => set({ showV2: show }),

            // === 模式切换 ===
            setAppMode: (mode) => set({ appMode: mode }),

            // === 历史记录操作 ===
            loadHistory: async () => {
                set({ isHistoryLoading: true });
                try {
                    let records: HistoryRecord[] = [];
                    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                        const wrap = await chrome.storage.local.get(['grading_history']);
                        records = Array.isArray(wrap?.grading_history) ? wrap.grading_history : [];
                    } else {
                        const saved = localStorage.getItem('grading_history');
                        records = saved ? JSON.parse(saved) : [];
                    }
                    set({ historyRecords: records, isHistoryLoading: false });
                } catch (e) {
                    set({ isHistoryLoading: false });
                }
            },

            addHistoryRecord: (data) => set((state) => {
                const newRecord: HistoryRecord = {
                    ...data,
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    isHidden: false
                };
                const newHistory = [newRecord, ...state.historyRecords].slice(0, 500);
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({ grading_history: newHistory });
                }
                localStorage.setItem('grading_history', JSON.stringify(newHistory));
                return { historyRecords: newHistory };
            }),

            deleteHistoryRecord: (id, hardDelete = false) => set((state) => {
                let newHistory;
                if (hardDelete) {
                    newHistory = state.historyRecords.filter(r => r.id !== id);
                } else {
                    newHistory = state.historyRecords.map(r => r.id === id ? { ...r, isHidden: true } : r);
                }
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({ grading_history: newHistory });
                }
                localStorage.setItem('grading_history', JSON.stringify(newHistory));
                return { historyRecords: newHistory };
            }),

            clearHistoryByQuestion: (questionKey) => set((state) => {
                const newHistory = state.historyRecords.filter(r => (r.questionKey || r.questionNo) !== questionKey);
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.set({ grading_history: newHistory });
                }
                localStorage.setItem('grading_history', JSON.stringify(newHistory));
                return { historyRecords: newHistory };
            }),

            // === 阅卷模式 ===
            setGradingMode: (mode) => set({ gradingMode: mode }),
            setStatus: (status) => set({ status }),

            // === 账户/激活码操作 ===
            setActivationCode: (code) => {
                set({ activationCode: code });
                if (code) {
                    localStorage.setItem('activation_code', code);
                    (get() as any).syncQuota(); // 切换代码后立即同步余额
                } else {
                    localStorage.removeItem('activation_code');
                    // 清空代码时也重置配额显示
                    set({
                        quota: { ...initialState.quota, remaining: 0, isPaid: false }
                    });
                }
            },

            setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),

            // === 考试管理操作实现 ===
            loadExams: async () => {
                // 如果不是正式会员，仅使用本地数据，不从服务器加载
                if (!(get() as any).isOfficial) {
                    return;
                }

                const { getExams } = await import('../services/proxyService');
                const exams = await getExams();
                // 简单的合并策略：如果服务器返回了数据，则覆盖；否则保留本地（防止断网清空）
                if (exams && exams.length > 0) {
                    set({ exams });
                }
            },

            createExamAction: async (params) => {
                const state = get() as any;

                // 1. 试用会员：仅本地创建
                if (!state.isOfficial) {
                    const newExam = {
                        id: `local_exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: params.name || '未命名考试',
                        date: params.date || new Date().toISOString(),
                        subject: params.subject || '',
                        grade: params.grade || '',
                        description: params.description || '',
                        updatedAt: new Date().toISOString()
                    };
                    set(state => ({ exams: [newExam, ...state.exams] }));
                    return newExam;
                }

                // 2. 正式会员：调用后端
                try {
                    const { createExam } = await import('../services/proxyService');
                    const exam = await createExam(params);
                    if (exam) {
                        set(state => ({ exams: [exam, ...state.exams] }));
                    }
                    return exam;
                } catch (e: any) {
                    // 如果是网络错误，也可以考虑降级为本地创建并标记未同步（后续优化）
                    throw e; // 暂时抛出，让 UI 处理报错
                }
            },

            updateExamAction: async (id, params) => {
                const state = get() as any;

                // 1. 试用会员或本地考试：本地更新
                if (!state.isOfficial || id.startsWith('local_')) {
                    const updatedExam = {
                        ...state.exams.find((e: any) => e.id === id),
                        ...params,
                        updatedAt: new Date().toISOString()
                    };

                    // 确保对象存在
                    if (!updatedExam.id) return null;

                    set(state => ({
                        exams: state.exams.map(e => e.id === id ? updatedExam : e)
                    }));
                    return updatedExam;
                }

                // 2. 正式会员且是服务端ID：调用后端
                const { updateExam } = await import('../services/proxyService');
                const exam = await updateExam(id, params);
                if (exam) {
                    set(state => ({
                        exams: state.exams.map(e => e.id === id ? exam : e)
                    }));
                }
                return exam;
            },

            deleteExamAction: async (id) => {
                const state = get() as any;

                // 1. 试用会员或本地考试：本地删除
                if (!state.isOfficial || id.startsWith('local_')) {
                    set(state => ({
                        exams: state.exams.filter(e => e.id !== id),
                        activeExamId: state.activeExamId === id ? null : state.activeExamId
                    }));
                    return true;
                }

                // 2. 正式会员：调用后端
                const { deleteExam } = await import('../services/proxyService');
                const success = await deleteExam(id);
                if (success) {
                    set(state => ({
                        exams: state.exams.filter(e => e.id !== id),
                        activeExamId: state.activeExamId === id ? null : state.activeExamId
                    }));
                }
                return success;
            },

            setActiveExamId: (id) => set({ activeExamId: id }),

            syncQuota: async () => {
                const { activationCode } = get() as any;
                const { checkActivationStatus } = await import('../services/proxyService');
                const status = await checkActivationStatus();

                set({
                    quota: {
                        remaining: status.quota || 0,
                        total: status.maxQuota || status.quota || 10,
                        isPaid: status.activated,
                        lastSync: Date.now(),
                        status: status.status || 'active'
                    }
                });
            },

            // === 顶部导航栏动作注册 ===
            setHeaderActions: (actions) => set({ headerActions: actions }),

            // === 全局任务管理 ===
            addTask: (task) => set((state) => ({
                tasks: [...state.tasks.filter(t => t.id !== task.id), task]
            })),
            updateTask: (id, updates) => set((state) => ({
                tasks: state.tasks.map((t) =>
                    t.id === id
                        ? (typeof updates === 'function' ? (updates as any)(t) : { ...t, ...updates })
                        : t
                )
            })),
            removeTask: (id) => set((state) => ({
                tasks: state.tasks.filter((t) => t.id !== id)
            })),

            // === 系统检测状态操作 ===
            setHealth: (healthUpdates) => set((state) => ({
                health: { ...state.health, ...healthUpdates, lastUpdate: Date.now() }
            })),

            // === 系统配置修改 ===
            setAutoGradingInterval: (interval) => set({ autoGradingInterval: interval }),
        }),
        {
            name: 'app-store', // localStorage key
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // 只持久化需要保存的状态
                gradingStrategy: state.gradingStrategy,
                activeTab: state.activeTab,
                gradingMode: state.gradingMode,
                showV2: state.showV2,
                appMode: state.appMode,
                historyRecords: state.historyRecords,
                activationCode: state.activationCode,
                hasSeenOnboarding: state.hasSeenOnboarding,
                quota: state.quota,
                autoGradingInterval: state.autoGradingInterval,
                rubricLibrary: state.rubricLibrary,
                rubricData: state.rubricData,
                exams: state.exams,
                activeExamId: state.activeExamId
            } as any)
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
