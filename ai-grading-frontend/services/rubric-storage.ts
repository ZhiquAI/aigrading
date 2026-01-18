/**
 * rubric-storage.ts - 评分细则存储抽象层
 * 
 * Local-First 策略：
 * - 读取：优先本地 → 本地无则请求后端
 * - 写入：先写本地 → 立即返回 → 后台异步同步
 * - 冲突：以 updatedAt 最新的为准
 */

import type { RubricJSON, RubricListItem } from '../types/rubric';
import { parseRubricJSON } from '../types/rubric';

// ==================== 配置 ====================

const STORAGE_PREFIX = 'rubric_v2_';
const BACKEND_URL = 'http://localhost:3000';

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

// ==================== 后端同步 ====================

/**
 * 获取设备 ID（用于后端识别）
 */
function getDeviceId(): string {
    let deviceId = localStorage.getItem('app_device_id');
    if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('app_device_id', deviceId);
    }
    return deviceId;
}

/**
 * 同步到后端（异步，不阻塞）
 */
async function syncToBackend(rubric: RubricJSON): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/rubrics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-id': getDeviceId(),
            },
            body: JSON.stringify(rubric),
        });

        if (!response.ok) {
            console.error(`[RubricStorage] Sync failed: HTTP ${response.status}`);
            return false;
        }

        console.log(`[RubricStorage] Synced to backend: ${rubric.questionId}`);
        return true;
    } catch (error) {
        console.error('[RubricStorage] Sync failed:', error);
        return false;
    }
}

/**
 * 从后端获取评分细则
 */
async function fetchFromBackend(questionId: string): Promise<RubricJSON | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/rubrics/${encodeURIComponent(questionId)}`, {
            headers: {
                'x-device-id': getDeviceId(),
            },
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return parseRubricJSON(data.rubric || data);
    } catch (error) {
        console.error(`[RubricStorage] Fetch failed for ${questionId}:`, error);
        return null;
    }
}

/**
 * 从后端获取所有评分细则列表
 */
async function fetchListFromBackend(): Promise<RubricListItem[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/rubrics`, {
            headers: {
                'x-device-id': getDeviceId(),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.rubrics || [];
    } catch (error) {
        console.error('[RubricStorage] Fetch list failed:', error);
        return [];
    }
}

// ==================== 公共 API (Local-First) ====================

/**
 * 同步状态
 */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

/**
 * 同步状态回调
 */
type SyncStatusListener = (questionId: string, status: SyncStatus) => void;

// 同步状态监听器
const syncStatusListeners: Set<SyncStatusListener> = new Set();

// 待同步队列
const pendingSyncs: Map<string, RubricJSON> = new Map();

// 同步状态
const syncStatuses: Map<string, SyncStatus> = new Map();

/**
 * 注册同步状态监听器
 */
export function onSyncStatusChange(listener: SyncStatusListener): () => void {
    syncStatusListeners.add(listener);
    return () => syncStatusListeners.delete(listener);
}

/**
 * 更新并通知同步状态
 */
function setSyncStatus(questionId: string, status: SyncStatus): void {
    syncStatuses.set(questionId, status);
    syncStatusListeners.forEach(listener => listener(questionId, status));
}

/**
 * 获取同步状态
 */
export function getSyncStatus(questionId: string): SyncStatus {
    return syncStatuses.get(questionId) || 'synced';
}

/**
 * 处理待同步队列
 */
async function processPendingSyncs(): Promise<void> {
    for (const [questionId, rubric] of pendingSyncs.entries()) {
        setSyncStatus(questionId, 'syncing');
        const success = await syncToBackend(rubric);
        if (success) {
            pendingSyncs.delete(questionId);
            setSyncStatus(questionId, 'synced');
        } else {
            setSyncStatus(questionId, 'error');
        }
    }
}

// 定时处理待同步队列（每 10 秒）
setInterval(processPendingSyncs, 10000);

/**
 * 保存评分细则（Local-First）
 * - 立即写入本地
 * - 后台异步同步到后端
 */
export function saveRubric(rubric: RubricJSON): void {
    // 更新时间戳
    const updatedRubric: RubricJSON = {
        ...rubric,
        updatedAt: new Date().toISOString(),
    };

    // 1. 先写本地（同步）
    saveToLocal(updatedRubric);

    // 2. 加入待同步队列
    pendingSyncs.set(rubric.questionId, updatedRubric);
    setSyncStatus(rubric.questionId, 'pending');

    // 3. 尝试立即同步
    syncToBackend(updatedRubric).then(success => {
        if (success) {
            pendingSyncs.delete(rubric.questionId);
            setSyncStatus(rubric.questionId, 'synced');
        }
    });
}

/**
 * 加载评分细则（Local-First）
 * - 优先从本地读取
 * - 本地无则尝试从后端获取
 */
export async function loadRubric(questionId: string): Promise<RubricJSON | null> {
    // 1. 先尝试本地
    const local = loadFromLocal(questionId);
    if (local) {
        console.log(`[RubricStorage] Loaded from local: ${questionId}`);
        return local;
    }

    // 2. 本地无，尝试后端
    console.log(`[RubricStorage] Local miss, trying backend: ${questionId}`);
    const remote = await fetchFromBackend(questionId);

    // 3. 如果后端有，缓存到本地
    if (remote) {
        saveToLocal(remote);
        return remote;
    }

    return null;
}

/**
 * 获取所有评分细则列表（Local-First）
 * - 返回本地列表，同时在后台同步
 */
export function listRubrics(): RubricListItem[] {
    // 1. 立即返回本地列表
    const localList = listLocal();

    // 2. 后台从后端拉取并合并
    fetchListFromBackend().then(async remoteList => {
        // 合并：后端有但本地没有的，从后端拉取完整数据
        for (const remote of remoteList) {
            const local = loadFromLocal(remote.questionId);
            if (!local) {
                // 本地没有，从后端获取完整数据
                const fullRubric = await fetchFromBackend(remote.questionId);
                if (fullRubric) {
                    saveToLocal(fullRubric);
                }
            } else if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
                // 后端更新，拉取最新
                const fullRubric = await fetchFromBackend(remote.questionId);
                if (fullRubric) {
                    saveToLocal(fullRubric);
                }
            }
        }
    });

    return localList;
}

/**
 * 删除评分细则
 */
export async function deleteRubric(questionId: string): Promise<void> {
    // 1. 先删本地
    deleteFromLocal(questionId);

    // 2. 后台删后端
    try {
        await fetch(`${BACKEND_URL}/api/rubrics/${encodeURIComponent(questionId)}`, {
            method: 'DELETE',
            headers: {
                'x-device-id': getDeviceId(),
            },
        });
    } catch (error) {
        console.error(`[RubricStorage] Delete from backend failed: ${questionId}`, error);
    }
}

/**
 * 强制从后端同步（用于首次启动或手动刷新）
 */
export async function forceSync(): Promise<void> {
    console.log('[RubricStorage] Force syncing from backend...');

    const remoteList = await fetchListFromBackend();

    for (const remote of remoteList) {
        const local = loadFromLocal(remote.questionId);

        // 如果本地没有，或后端更新，则拉取
        if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
            const fullRubric = await fetchFromBackend(remote.questionId);
            if (fullRubric) {
                saveToLocal(fullRubric);
            }
        }
    }

    console.log('[RubricStorage] Force sync completed');
}
