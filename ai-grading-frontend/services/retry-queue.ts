/**
 * retry-queue.ts - 重试队列服务
 * 
 * 用于缓存失败的 AI 请求，支持离线重试
 */

import { saveImage, getImage, deleteImage } from '../utils/imageDB';

// ==================== 类型定义 ====================

export interface PendingRequest {
    id: string;
    type: 'grading' | 'rubric_generate' | 'rubric_refine';
    timestamp: number;
    data: {
        imageBase64?: string;
        rubric?: string;
        studentName?: string;
        questionId?: string;
        suggestion?: string;
    };
    retryCount: number;
    maxRetries: number;
    lastError?: string;
}

// ==================== 存储 Key ====================

const QUEUE_STORAGE_KEY = 'ai_retry_queue';

// ==================== 队列操作 ====================

/**
 * 获取所有待重试请求
 */
export function getPendingRequests(): PendingRequest[] {
    try {
        const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * 添加请求到重试队列
 */
export async function addToRetryQueue(request: Omit<PendingRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = `retry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 如果有图片，存储到 IndexedDB
    if (request.data.imageBase64) {
        await saveImage(id, request.data.imageBase64);
        // 只在 localStorage 中存储元信息
        request.data = { ...request.data, imageBase64: undefined };
    }

    const pendingRequest: PendingRequest = {
        ...request,
        id,
        timestamp: Date.now(),
        retryCount: 0
    };

    const queue = getPendingRequests();
    queue.push(pendingRequest);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));

    console.log(`[RetryQueue] 已添加到重试队列: ${id} (类型: ${request.type})`);
    return id;
}

/**
 * 从队列中移除请求
 */
export async function removeFromQueue(id: string): Promise<void> {
    // 尝试删除关联的图片
    try {
        await deleteImage(id);
    } catch {
        // 忽略图片删除错误
    }

    const queue = getPendingRequests().filter(r => r.id !== id);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    console.log(`[RetryQueue] 已从队列移除: ${id}`);
}

/**
 * 更新请求状态（增加重试次数、记录错误）
 */
export function updateRequestStatus(id: string, updates: Partial<Pick<PendingRequest, 'retryCount' | 'lastError'>>): void {
    const queue = getPendingRequests();
    const index = queue.findIndex(r => r.id === id);

    if (index !== -1) {
        queue[index] = { ...queue[index], ...updates };
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
}

/**
 * 获取待重试请求（含图片数据）
 */
export async function getRequestWithImage(id: string): Promise<PendingRequest | null> {
    const queue = getPendingRequests();
    const request = queue.find(r => r.id === id);

    if (!request) return null;

    // 从 IndexedDB 恢复图片
    const image = await getImage(id);
    if (image) {
        request.data.imageBase64 = image.data;
    }

    return request;
}

/**
 * 清空已超时或超过重试次数的请求
 */
export async function cleanupExpiredRequests(maxAgeHours: number = 24): Promise<number> {
    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    const queue = getPendingRequests();

    const toRemove = queue.filter(r =>
        r.timestamp < cutoff ||
        r.retryCount >= r.maxRetries
    );

    for (const req of toRemove) {
        await removeFromQueue(req.id);
    }

    console.log(`[RetryQueue] 已清理 ${toRemove.length} 个过期请求`);
    return toRemove.length;
}

/**
 * 获取队列统计信息
 */
export function getQueueStats(): { total: number; byType: Record<string, number> } {
    const queue = getPendingRequests();
    const byType: Record<string, number> = {};

    for (const req of queue) {
        byType[req.type] = (byType[req.type] || 0) + 1;
    }

    return { total: queue.length, byType };
}
