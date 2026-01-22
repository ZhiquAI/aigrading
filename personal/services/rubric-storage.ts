/**
 * rubric-storage.ts - 评分细则本地存储
 * 
 * 个人版：仅本地存储，无后端同步
 */

import type { RubricJSON, RubricListItem } from '../types/rubric';
import { parseRubricJSON } from '../types/rubric';

// ==================== 配置 ====================

const STORAGE_PREFIX = 'rubric_v2_';

// ==================== 本地存储 ====================

/**
 * 保存评分细则到本地
 */
function saveToLocal(rubric: RubricJSON): void {
    const key = `${STORAGE_PREFIX}${rubric.questionId}`;
    localStorage.setItem(key, JSON.stringify(rubric));
    console.log(`[RubricStorage] Saved to local: ${rubric.questionId}`);
}

/**
 * 从本地读取评分细则
 */
function loadFromLocal(questionId: string): RubricJSON | null {
    const key = `${STORAGE_PREFIX}${questionId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    try {
        return parseRubricJSON(JSON.parse(data));
    } catch (error) {
        console.error(`[RubricStorage] Failed to parse local data for ${questionId}:`, error);
        return null;
    }
}

/**
 * 获取所有本地评分细则列表
 */
function listLocal(): RubricListItem[] {
    const items: RubricListItem[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;

        try {
            const data = localStorage.getItem(key);
            if (!data) continue;

            const rubric = parseRubricJSON(JSON.parse(data));
            items.push({
                questionId: rubric.questionId,
                title: rubric.title,
                totalScore: rubric.totalScore,
                pointCount: rubric.answerPoints.length,
                updatedAt: rubric.updatedAt,
            });
        } catch (error) {
            console.error(`[RubricStorage] Failed to parse ${key}:`, error);
        }
    }

    // 按更新时间降序排列
    return items.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * 从本地删除评分细则
 */
function deleteFromLocal(questionId: string): void {
    const key = `${STORAGE_PREFIX}${questionId}`;
    localStorage.removeItem(key);
    console.log(`[RubricStorage] Deleted from local: ${questionId}`);
}

// ==================== 公共 API ====================

/**
 * 同步状态（个人版始终为 synced）
 */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

/**
 * 同步状态回调
 */
type SyncStatusListener = (questionId: string, status: SyncStatus) => void;

// 同步状态监听器
const syncStatusListeners: Set<SyncStatusListener> = new Set();

/**
 * 注册同步状态监听器
 */
export function onSyncStatusChange(listener: SyncStatusListener): () => void {
    syncStatusListeners.add(listener);
    return () => syncStatusListeners.delete(listener);
}

/**
 * 获取同步状态（个人版始终返回 synced）
 */
export function getSyncStatus(_questionId: string): SyncStatus {
    return 'synced';
}

/**
 * 保存评分细则
 */
export function saveRubric(rubric: RubricJSON): void {
    // 更新时间戳
    const updatedRubric: RubricJSON = {
        ...rubric,
        updatedAt: new Date().toISOString(),
    };

    // 写入本地
    saveToLocal(updatedRubric);
}

/**
 * 加载评分细则
 */
export async function loadRubric(questionId: string): Promise<RubricJSON | null> {
    return loadFromLocal(questionId);
}

/**
 * 获取所有评分细则列表
 */
export function listRubrics(): RubricListItem[] {
    return listLocal();
}

/**
 * 删除评分细则
 */
export async function deleteRubric(questionId: string): Promise<void> {
    deleteFromLocal(questionId);
}

/**
 * 强制同步（个人版无操作）
 */
export async function forceSync(): Promise<void> {
    console.log('[RubricStorage] Personal version - no backend sync');
}
