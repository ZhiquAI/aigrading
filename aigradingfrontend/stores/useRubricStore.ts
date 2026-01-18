/**
 * useRubricStore.ts - 评分细则状态管理
 * 
 * 基于 Zustand，集成 Local-First 存储
 */

import { create } from 'zustand';
import type { RubricJSON, RubricListItem } from '../types/rubric';
import { createEmptyRubric } from '../types/rubric';
import {
    saveRubric,
    loadRubric,
    listRubrics,
    deleteRubric,
    getSyncStatus,
    onSyncStatusChange,
    forceSync,
    type SyncStatus,
} from '../services/rubric-storage';

// ==================== 类型定义 ====================

interface RubricState {
    /** 当前编辑的评分细则 */
    currentRubric: RubricJSON | null;
    /** 评分细则列表 */
    rubricList: RubricListItem[];
    /** 加载状态 */
    isLoading: boolean;
    /** 错误信息 */
    error: string | null;
    /** 各评分细则的同步状态 */
    syncStatuses: Map<string, SyncStatus>;
}

interface RubricActions {
    /** 加载评分细则 */
    load: (questionId: string) => Promise<RubricJSON | null>;
    /** 保存评分细则 */
    save: (rubric: RubricJSON) => void;
    /** 创建新评分细则 */
    create: (questionId: string) => RubricJSON;
    /** 删除评分细则 */
    remove: (questionId: string) => Promise<void>;
    /** 刷新列表 */
    refreshList: () => void;
    /** 强制同步 */
    forceSync: () => Promise<void>;
    /** 清除当前编辑 */
    clearCurrent: () => void;
    /** 设置错误 */
    setError: (error: string | null) => void;
}

type RubricStore = RubricState & RubricActions;

// ==================== Store ====================

export const useRubricStore = create<RubricStore>((set, get) => ({
    // 初始状态
    currentRubric: null,
    rubricList: [],
    isLoading: false,
    error: null,
    syncStatuses: new Map(),

    // 加载评分细则
    load: async (questionId: string) => {
        set({ isLoading: true, error: null });

        try {
            const rubric = await loadRubric(questionId);
            set({
                currentRubric: rubric,
                isLoading: false
            });
            return rubric;
        } catch (error) {
            const message = error instanceof Error ? error.message : '加载失败';
            set({ error: message, isLoading: false });
            return null;
        }
    },

    // 保存评分细则
    save: (rubric: RubricJSON) => {
        saveRubric(rubric);
        set({ currentRubric: rubric });

        // 更新列表
        get().refreshList();
    },

    // 创建新评分细则
    create: (questionId: string) => {
        const rubric = createEmptyRubric(questionId);
        set({ currentRubric: rubric });
        return rubric;
    },

    // 删除评分细则
    remove: async (questionId: string) => {
        set({ isLoading: true });

        try {
            await deleteRubric(questionId);

            // 如果删除的是当前编辑的，清空
            const { currentRubric } = get();
            if (currentRubric?.questionId === questionId) {
                set({ currentRubric: null });
            }

            // 刷新列表
            get().refreshList();
        } catch (error) {
            const message = error instanceof Error ? error.message : '删除失败';
            set({ error: message });
        } finally {
            set({ isLoading: false });
        }
    },

    // 刷新列表
    refreshList: () => {
        const list = listRubrics();
        set({ rubricList: list });
    },

    // 强制同步
    forceSync: async () => {
        set({ isLoading: true });

        try {
            await forceSync();
            get().refreshList();
        } catch (error) {
            const message = error instanceof Error ? error.message : '同步失败';
            set({ error: message });
        } finally {
            set({ isLoading: false });
        }
    },

    // 清除当前编辑
    clearCurrent: () => {
        set({ currentRubric: null });
    },

    // 设置错误
    setError: (error: string | null) => {
        set({ error });
    },
}));

// ==================== 初始化 ====================

// 监听同步状态变化
onSyncStatusChange((questionId, status) => {
    const { syncStatuses } = useRubricStore.getState();
    const newStatuses = new Map(syncStatuses);
    newStatuses.set(questionId, status);
    useRubricStore.setState({ syncStatuses: newStatuses });
});

// 启动时加载列表
if (typeof window !== 'undefined') {
    // 延迟执行，确保 localStorage 可用
    setTimeout(() => {
        useRubricStore.getState().refreshList();
    }, 0);
}

// ==================== Hooks ====================

/**
 * 获取当前评分细则
 */
export function useCurrentRubric() {
    return useRubricStore(state => state.currentRubric);
}

/**
 * 获取评分细则列表
 */
export function useRubricList() {
    return useRubricStore(state => state.rubricList);
}

/**
 * 获取加载状态
 */
export function useRubricLoading() {
    return useRubricStore(state => state.isLoading);
}

/**
 * 获取某个评分细则的同步状态
 */
export function useRubricSyncStatus(questionId: string): SyncStatus {
    return useRubricStore(state => state.syncStatuses.get(questionId) || 'synced');
}

export default useRubricStore;
