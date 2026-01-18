/**
 * 后端代理服务
 * 通过后端 API 调用 AI 进行批改
 * 
 * 所有 AI 调用强制通过后端，不再支持前端直连 fallback
 */

import { StudentResult } from '../types';

// 后端 API 地址
// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3000';

// 获取设备 ID（用于限制使用次数）
function getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// 代理模式配置（默认使用前端直连模式）
export function isProxyMode(): boolean {
    const saved = localStorage.getItem('proxy_mode');
    // 默认值为 false（前端直连模式）
    return saved === 'true';
}

export function setProxyMode(enabled: boolean): void {
    localStorage.setItem('proxy_mode', enabled ? 'true' : 'false');
}

// 获取剩余使用次数
export interface UsageInfo {
    isActivated: boolean;
    todayUsage: number;
    dailyLimit: number;
    remaining: number;  // -1 表示无限
}

export async function getUsageInfo(): Promise<UsageInfo> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/grade`, {
            method: 'GET',
            headers: {
                'x-device-id': getDeviceId()
            }
        });

        if (!response.ok) {
            throw new Error('获取使用信息失败');
        }

        const result = await response.json();
        const data = result.data || result;

        return {
            isActivated: data.isPaid || false,
            remaining: data.isPaid ? -1 : (data.quota || 300),
            todayUsage: data.totalUsed || 0,
            dailyLimit: data.isPaid ? -1 : 300
        };
    } catch (error) {
        console.error('[Proxy] Failed to get usage info:', error);
        return {
            isActivated: false,
            todayUsage: 0,
            dailyLimit: 300,
            remaining: 300
        };
    }
}

// 通过后端代理批改学生答案
export interface ProxyGradeResult {
    score: number;
    maxScore: number;
    comment: string;
    breakdown: {
        label: string;
        score: number;
        max: number;
        comment?: string;
        isNegative?: boolean;
    }[];
    remaining: number;
    isActivated: boolean;
}

export async function gradeWithProxy(
    imageBase64: string,
    rubric: string,
    studentName?: string,
    questionNo?: string,
    strategy?: 'flash' | 'pro' | 'reasoning'
): Promise<StudentResult> {
    const deviceId = getDeviceId();

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    // 优先使用 JSON 格式评分细则（如果存在）
    let rubricToSend = rubric;
    if (lastGeneratedRubricJSON) {
        // 将 JSON 结构序列化发送，后端会识别并使用 JSON 模式评分
        rubricToSend = JSON.stringify(lastGeneratedRubricJSON);
        console.log('[Proxy] Using JSON rubric for grading');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/grade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-id': deviceId
            },
            body: JSON.stringify({
                imageBase64,
                rubric: rubricToSend,
                studentName,
                questionNo,
                strategy: strategy || 'pro'  // 默认使用精准模式
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.success) {
            const result = data.data as ProxyGradeResult;

            return {
                id: Date.now().toString(),
                name: studentName || '自动识别',
                className: '自动识别',
                score: result.score,
                maxScore: result.maxScore,
                comment: result.comment,
                breakdown: result.breakdown.map(b => ({
                    label: b.label,
                    score: b.score,
                    max: b.max,
                    comment: b.comment,
                    isNegative: b.isNegative || false
                }))
            };
        }

        // 后端返回失败
        throw new Error(data.message || '批改失败');
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('批改超时，请重试');
        }

        throw error;
    }
}

// 验证激活码
export async function verifyActivationCode(code: string): Promise<{
    success: boolean;
    type?: string;
    expiresAt?: string;
    message: string;
}> {
    const deviceId = getDeviceId();

    try {
        const response = await fetch(`${API_BASE_URL}/api/activation/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                deviceId
            })
        });

        const data = await response.json();
        return {
            success: data.success,
            type: data.data?.type,
            expiresAt: data.data?.expiresAt,
            message: data.message
        };
    } catch (error) {
        return {
            success: false,
            message: '网络错误，请重试'
        };
    }
}

// 查询激活状态
export async function checkActivationStatus(): Promise<{
    activated: boolean;
    type?: string;
    expiresAt?: string;
}> {
    const deviceId = getDeviceId();

    try {
        const response = await fetch(`${API_BASE_URL}/api/activation/verify?deviceId=${deviceId}`, {
            method: 'GET'
        });

        const data = await response.json();
        return {
            activated: data.data?.activated || false,
            type: data.data?.type,
            expiresAt: data.data?.expiresAt
        };
    } catch (error) {
        return { activated: false };
    }
}

// 通过后端代理生成评分细则
// 返回 Markdown 格式（兼容旧版），同时存储 JSON 到全局变量供评分使用
let lastGeneratedRubricJSON: import('../types').RubricJSON | null = null;

export function getLastGeneratedRubricJSON(): import('../types').RubricJSON | null {
    return lastGeneratedRubricJSON;
}

// 手动设置导入的 RubricJSON（用于导入功能）
export function setImportedRubricJSON(rubricJSON: import('../types').RubricJSON): void {
    lastGeneratedRubricJSON = rubricJSON;
    console.log('[Proxy] Imported RubricJSON, answerPoints:', rubricJSON.answerPoints?.length);
}

export async function generateRubricWithProxy(
    questionImage?: string | null,
    answerImage?: string | null
): Promise<string> {
    if (!questionImage && !answerImage) {
        throw new Error('请提供至少一张图片（试题或答案）');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/rubric`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                questionImage,
                answerImage
            })
        });

        const data = await response.json();

        if (data.success) {
            // 存储 JSON 结构用于后续评分
            if (data.data.rubricJSON) {
                lastGeneratedRubricJSON = data.data.rubricJSON;
                console.log('[Proxy] Rubric JSON saved, answerPoints:', data.data.rubricJSON.answerPoints?.length);
            }
            // 返回 Markdown 格式（兼容旧版）
            return data.data.rubric;
        }

        throw new Error(data.message || '生成评分细则失败');
    } catch (error: any) {
        console.error('[Proxy] Generate rubric failed:', error);
        throw new Error(`生成评分细则失败：${error.message || '后端服务不可用'}`);
    }
}

// 通过后端代理格式化评分细则
export async function standardizeRubricWithProxy(
    rubric: string,
    maxScore?: number
): Promise<string> {
    if (!rubric || !rubric.trim()) {
        throw new Error('请提供评分细则内容');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/rubric/standardize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rubric,
                maxScore
            })
        });

        const data = await response.json();

        if (data.success) {
            return data.data.rubric;
        }

        throw new Error(data.message || '标准化评分细则失败');
    } catch (error: any) {
        console.error('[Proxy] Standardize rubric failed:', error);
        throw new Error(`标准化评分细则失败：${error.message || '后端服务不可用'}`);
    }
}

// ==================== 评分细则同步 ====================

export interface RubricRecord {
    questionKey: string;
    rubric: string;
    updatedAt: string;
}

/**
 * 保存评分细则到后端服务器
 */
export async function saveRubricToServer(questionKey: string, rubric: string): Promise<boolean> {
    if (!questionKey || !rubric?.trim()) {
        console.warn('[Proxy] saveRubricToServer: 参数无效');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/rubric`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceId: getDeviceId(),
                questionKey,
                rubric
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('[Proxy] 评分细则已同步到服务器:', questionKey);
            return true;
        }

        console.warn('[Proxy] 评分细则同步失败:', data.message);
        return false;
    } catch (error) {
        console.error('[Proxy] saveRubricToServer error:', error);
        return false;
    }
}

/**
 * 从后端服务器加载单个评分细则
 */
export async function loadRubricFromServer(questionKey: string): Promise<string | null> {
    if (!questionKey) return null;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/rubric?deviceId=${encodeURIComponent(getDeviceId())}&questionKey=${encodeURIComponent(questionKey)}`,
            { method: 'GET' }
        );

        const data = await response.json();

        if (data.success && data.data?.rubric) {
            console.log('[Proxy] 从服务器加载评分细则:', questionKey);
            return data.data.rubric;
        }

        return null;
    } catch (error) {
        console.error('[Proxy] loadRubricFromServer error:', error);
        return null;
    }
}

/**
 * 从后端服务器加载所有评分细则
 */
export async function loadAllRubricsFromServer(): Promise<RubricRecord[]> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/rubric?deviceId=${encodeURIComponent(getDeviceId())}`,
            { method: 'GET' }
        );

        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
            console.log('[Proxy] 从服务器加载所有评分细则:', data.data.length, '条');
            return data.data;
        }

        return [];
    } catch (error) {
        console.error('[Proxy] loadAllRubricsFromServer error:', error);
        return [];
    }
}

/**
 * 从后端服务器删除评分细则
 */
export async function deleteRubricFromServer(questionKey: string): Promise<boolean> {
    if (!questionKey) return false;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/rubric?deviceId=${encodeURIComponent(getDeviceId())}&questionKey=${encodeURIComponent(questionKey)}`,
            { method: 'DELETE' }
        );

        const data = await response.json();

        if (data.success) {
            console.log('[Proxy] 已从服务器删除评分细则:', questionKey);
            return true;
        }

        return false;
    } catch (error) {
        console.error('[Proxy] deleteRubricFromServer error:', error);
        return false;
    }
}

