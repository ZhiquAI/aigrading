/**
 * record-sync.ts - 批改记录同步服务
 * 
 * 功能：
 * - 从后端获取批改记录（按激活码）
 * - 批量上传本地记录到后端
 * - 支持增量同步
 */

// 本地定义批改结果类型（与应用中使用的类型兼容）
export interface GradingResult {
    id?: string;
    studentName?: string;
    name?: string;
    score: number;
    maxScore: number;
    questionNo?: string;
    questionKey?: string;
    examNo?: string;
    comment?: string;
    breakdown?: Record<string, unknown>;
    timestamp?: number;
}

// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// ==================== 工具函数 ====================

/**
 * 获取激活码
 */
export function getActivationCode(): string | null {
    return localStorage.getItem('activation_code');
}

/**
 * 获取设备 ID
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
 * 检查是否可以同步（支持设备 ID 回退）
 */
export function canSync(): boolean {
    // 有激活码或设备ID都可以同步
    return !!getActivationCode() || !!getDeviceId();
}

// ==================== 后端 API ====================

export interface SyncedRecord {
    id: string;
    questionNo?: string;
    questionKey?: string;
    studentName: string;
    examNo?: string;
    score: number;
    maxScore: number;
    comment?: string;
    breakdown?: Record<string, unknown>;
    createdAt: string;
    timestamp: number;
    deviceId?: string;
}

export interface FetchRecordsResponse {
    success: boolean;
    data?: {
        records: SyncedRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    message?: string;
}

/**
 * 从后端获取批改记录
 * 支持设备 ID 回退机制：后端会使用 device:${deviceId} 作为标识符
 */
export async function fetchRecordsFromServer(options?: {
    page?: number;
    limit?: number;
    questionNo?: string;
    questionKey?: string;
}): Promise<FetchRecordsResponse> {
    try {
        const params = new URLSearchParams();
        if (options?.page) params.append('page', String(options.page));
        if (options?.limit) params.append('limit', String(options.limit));
        if (options?.questionNo) params.append('questionNo', options.questionNo);
        if (options?.questionKey) params.append('questionKey', options.questionKey);

        const url = `${API_BASE_URL}/api/sync/records${params.toString() ? `?${params}` : ''}`;

        const headers: Record<string, string> = {
            'x-device-id': getDeviceId(),
        };

        const activationCode = getActivationCode();
        if (activationCode) {
            headers['x-activation-code'] = activationCode;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            success: data.success,
            data: data.data,
            message: data.message,
        };
    } catch (error) {
        console.error('[RecordSync] Fetch failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '获取记录失败',
        };
    }
}

/**
 * 上传批改记录到后端
 * 支持设备 ID 回退机制：后端会使用 device:${deviceId} 作为标识符
 */
export async function uploadRecordsToServer(
    records: Array<{
        studentName?: string;
        name?: string;
        score: number;
        maxScore: number;
        questionNo?: string;
        questionKey?: string;
        examNo?: string;
        comment?: string;
        breakdown?: unknown;
    }>
): Promise<{ success: boolean; created?: number; message?: string }> {
    if (!records || records.length === 0) {
        return { success: true, created: 0 };
    }

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-device-id': getDeviceId(),
        };

        const activationCode = getActivationCode();
        if (activationCode) {
            headers['x-activation-code'] = activationCode;
        }

        const response = await fetch(`${API_BASE_URL}/api/sync/records`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ records }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`[RecordSync] Uploaded ${data.data?.created || 0} records`);
        return {
            success: data.success,
            created: data.data?.created,
            message: data.message,
        };
    } catch (error) {
        console.error('[RecordSync] Upload failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '上传记录失败',
        };
    }
}

/**
 * 删除后端记录
 * 支持设备 ID 回退机制：后端会使用 device:${deviceId} 作为标识符
 */
export async function deleteRecordFromServer(
    options: { id?: string; questionNo?: string; questionKey?: string }
): Promise<{ success: boolean; message?: string }> {
    try {
        const params = new URLSearchParams();
        if (options.id) params.append('id', options.id);
        if (options.questionNo) params.append('questionNo', options.questionNo);
        if (options.questionKey) params.append('questionKey', options.questionKey);

        const headers: Record<string, string> = {
            'x-device-id': getDeviceId(),
        };

        const activationCode = getActivationCode();
        if (activationCode) {
            headers['x-activation-code'] = activationCode;
        }

        const response = await fetch(`${API_BASE_URL}/api/sync/records?${params}`, {
            method: 'DELETE',
            headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            success: data.success,
            message: data.message,
        };
    } catch (error) {
        console.error('[RecordSync] Delete failed:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '删除记录失败',
        };
    }
}

// ==================== 本地存储集成 ====================

const LOCAL_RECORDS_KEY = 'grading_records_v2';
const LAST_SYNC_KEY = 'records_last_sync';

/**
 * 获取本地存储的记录
 */
export function getLocalRecords(): GradingResult[] {
    try {
        const data = localStorage.getItem(LOCAL_RECORDS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * 保存记录到本地
 */
export function saveLocalRecords(records: GradingResult[]): void {
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
}

/**
 * 添加单条记录到本地
 */
export function addLocalRecord(record: GradingResult): void {
    const records = getLocalRecords();
    records.unshift(record);
    saveLocalRecords(records);
}

/**
 * 同步状态
 */
export type RecordSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * 执行完整同步（拉取 + 推送）
 * 支持设备 ID 回退机制
 */
export async function syncRecords(options?: {
    onStatusChange?: (status: RecordSyncStatus, message?: string) => void;
}): Promise<{ success: boolean; message?: string }> {
    const { onStatusChange } = options || {};

    if (!canSync()) {
        return { success: false, message: '无法同步：需要设备 ID 或激活码' };
    }

    onStatusChange?.('syncing', '正在同步记录…');

    try {
        // 1. 从后端拉取记录
        const fetchResult = await fetchRecordsFromServer({ limit: 100 });

        if (!fetchResult.success) {
            throw new Error(fetchResult.message);
        }

        const serverRecords = fetchResult.data?.records || [];
        const localRecords = getLocalRecords();

        // 2. 合并记录（简单策略：按时间戳去重）
        const serverIds = new Set(serverRecords.map(r => r.id));
        const newLocalRecords = localRecords.filter(r => !serverIds.has(r.id));

        // 3. 如果有本地独有记录，上传到后端
        if (newLocalRecords.length > 0) {
            onStatusChange?.('syncing', `正在上传 ${newLocalRecords.length} 条记录…`);
            await uploadRecordsToServer(newLocalRecords.map(r => ({
                studentName: r.studentName || r.name,
                score: r.score,
                maxScore: r.maxScore,
                questionNo: r.questionNo,
                questionKey: r.questionKey,
                examNo: r.examNo,
                comment: r.comment,
                breakdown: r.breakdown,
            })));
        }

        // 4. 合并并保存到本地
        const mergedRecords = [
            ...serverRecords.map(r => ({
                id: r.id,
                studentName: r.studentName,
                name: r.studentName,
                score: r.score,
                maxScore: r.maxScore,
                questionNo: r.questionNo,
                questionKey: r.questionKey,
                examNo: r.examNo,
                comment: r.comment || '',
                breakdown: r.breakdown,
                timestamp: r.timestamp || new Date(r.createdAt).getTime(),
            } as GradingResult)),
            ...newLocalRecords,
        ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        saveLocalRecords(mergedRecords);
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

        onStatusChange?.('success', `同步完成，共 ${mergedRecords.length} 条记录`);
        console.log(`[RecordSync] Sync completed: ${mergedRecords.length} total records`);

        return { success: true, message: `同步完成` };
    } catch (error) {
        const message = error instanceof Error ? error.message : '同步失败';
        onStatusChange?.('error', message);
        console.error('[RecordSync] Sync failed:', error);
        return { success: false, message };
    }
}

/**
 * 获取上次同步时间
 */
export function getLastSyncTime(): string | null {
    return localStorage.getItem(LAST_SYNC_KEY);
}
