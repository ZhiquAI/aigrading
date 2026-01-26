/**
 * 后端代理服务
 * 通过后端 API 调用 AI 进行批改
 * 
 * 所有 AI 调用强制通过后端，不再支持前端直连 fallback
 */

import { StudentResult } from '../types';

// 后端 API 地址
// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

// 获取设备 ID（用于限制使用次数）
export function getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// 代理模式配置
// 生产环境（配置了后端 API 地址）默认使用代理模式
// 开发环境默认使用前端直连模式
export function isProxyMode(): boolean {
    const saved = localStorage.getItem('proxy_mode');
    if (saved !== null) {
        return saved === 'true';
    }
    // 如果没有手动设置，根据环境变量决定默认值
    // 有 VITE_API_BASE_URL 配置时，默认使用代理模式
    // @ts-ignore - Vite 环境变量
    const hasBackendUrl = !!import.meta.env?.VITE_API_BASE_URL;
    return hasBackendUrl;
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
    status: string;
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
            dailyLimit: data.isPaid ? -1 : 300,
            status: data.status || 'active'
        };
    } catch (error) {
        console.error('[Proxy] Failed to get usage info:', error);
        return {
            isActivated: false,
            todayUsage: 0,
            dailyLimit: 300,
            remaining: 300,
            status: 'active'
        };
    }
}

// 获取激活码
function getActivationCode(): string | null {
    return localStorage.getItem('activation_code');
}

/**
 * 图片压缩配置
 */
interface ImageCompressionOptions {
    maxWidth?: number;      // 最大宽度，默认 1200px
    quality?: number;       // JPEG 质量，默认 0.75
    grayscale?: boolean;    // 是否转灰度，默认 true（答卷通常是黑白的）
}

/**
 * 压缩 Base64 图片以加速上传和 AI 处理
 * - 缩小尺寸：将图片宽度限制在 maxWidth 以内
 * - 灰度化：答卷通常是黑白的，去除颜色可减少约2/3数据量
 * - JPEG 压缩：使用 0.75 质量可减少约50%数据量
 * 
 * 预计可将图片体积减少 70-90%，从而提速 3-5 倍
 */
async function compressImageBase64(
    base64: string,
    options: ImageCompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 1200,
        quality = 0.75,
        grayscale = true
    } = options;

    return new Promise((resolve, reject) => {
        try {
            // 解析 Base64 数据
            let imageData = base64;
            let mimeType = 'image/png';

            if (base64.startsWith('data:')) {
                const parts = base64.split(',');
                if (parts.length === 2) {
                    const mimeMatch = parts[0].match(/data:([^;]+)/);
                    if (mimeMatch) {
                        mimeType = mimeMatch[1];
                    }
                    imageData = parts[1];
                }
            }

            // 创建图片对象
            const img = new Image();
            img.onload = () => {
                try {
                    // 计算新尺寸
                    let newWidth = img.width;
                    let newHeight = img.height;

                    if (newWidth > maxWidth) {
                        const ratio = maxWidth / newWidth;
                        newWidth = maxWidth;
                        newHeight = Math.round(img.height * ratio);
                    }

                    // 创建 Canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        console.warn('[ImageCompress] Canvas context not available, using original');
                        resolve(base64);
                        return;
                    }

                    // 绘制图片
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);

                    // 灰度化处理
                    if (grayscale) {
                        const imageDataObj = ctx.getImageData(0, 0, newWidth, newHeight);
                        const data = imageDataObj.data;

                        for (let i = 0; i < data.length; i += 4) {
                            // 使用亮度公式转换为灰度
                            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                            data[i] = gray;     // R
                            data[i + 1] = gray; // G
                            data[i + 2] = gray; // B
                            // Alpha 保持不变
                        }

                        ctx.putImageData(imageDataObj, 0, 0);
                    }

                    // 导出为 JPEG（压缩率更高）
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

                    // 记录压缩效果
                    const originalSize = Math.round(base64.length * 0.75 / 1024); // 估算原始大小 KB
                    const compressedSize = Math.round(compressedBase64.length * 0.75 / 1024);
                    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

                    console.log(`[ImageCompress] ${img.width}x${img.height} -> ${newWidth}x${newHeight}, ` +
                        `${originalSize}KB -> ${compressedSize}KB (${compressionRatio}% 压缩率)`);

                    resolve(compressedBase64);
                } catch (err) {
                    console.warn('[ImageCompress] Processing error, using original:', err);
                    resolve(base64);
                }
            };

            img.onerror = () => {
                console.warn('[ImageCompress] Image load error, using original');
                resolve(base64);
            };

            // 加载图片
            if (!base64.startsWith('data:')) {
                img.src = `data:${mimeType};base64,${imageData}`;
            } else {
                img.src = base64;
            }
        } catch (err) {
            console.warn('[ImageCompress] Compression error, using original:', err);
            resolve(base64);
        }
    });
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
    status?: string;
}

export async function gradeWithProxy(
    imageBase64: string,
    rubric: string,
    studentName?: string,
    questionNo?: string,
    strategy?: 'flash' | 'pro' | 'reasoning',
    options?: { questionKey?: string; examNo?: string }
): Promise<StudentResult> {
    const deviceId = getDeviceId();
    const activationCode = getActivationCode();

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

    // 构建请求头
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': deviceId
    };

    // 如果有激活码，添加到 header（后端会自动存储批改记录）
    if (activationCode) {
        headers['x-activation-code'] = activationCode;
    }

    try {
        // 压缩图片以加速上传和 AI 处理
        const compressedImage = await compressImageBase64(imageBase64, {
            maxWidth: 1000,   // 限制宽度为 1000px (平衡清晰度和速度)
            quality: 0.6,    // JPEG 质量 60% (进一步减小体积)
            grayscale: true  // 转灰度（答卷通常是黑白的）
        });

        const response = await fetch(`${API_BASE_URL}/api/ai/grade`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                imageBase64: compressedImage,
                rubric: rubricToSend,
                studentName,
                questionNo,
                questionKey: options?.questionKey,
                examNo: options?.examNo,
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
    code?: string;
    type?: string;
    quota?: number;
    maxQuota?: number;
    used?: number;
    expiresAt?: string;
    status?: string;
}> {
    const deviceId = getDeviceId();

    try {
        const response = await fetch(`${API_BASE_URL}/api/activation/verify?deviceId=${deviceId}`, {
            method: 'GET'
        });

        const data = await response.json();
        const resData = data.data || {};
        return {
            activated: resData.isPaid || false,
            code: resData.code,
            type: resData.type,
            quota: resData.quota,
            maxQuota: resData.maxQuota,
            used: resData.used,
            expiresAt: resData.expiresAt,
            status: resData.status
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

// ==================== 考试汇总管理 ====================

export interface Exam {
    id: string;
    name: string;
    date: string | null;
    subject: string | null;
    grade: string | null;
    description: string | null;
    updatedAt: string;
}

/**
 * 获取所有考试列表
 */
export async function getExams(): Promise<Exam[]> {
    const activationCode = getActivationCode();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, {
            method: 'GET',
            headers: {
                'x-activation-code': activationCode || ''
            }
        });

        const data = await response.json();
        if (data.success) {
            return data.exams;
        }
        return [];
    } catch (error) {
        console.error('[Proxy] getExams error:', error);
        return [];
    }
}

/**
 * 创建新考试
 */
export async function createExam(params: Partial<Exam>): Promise<Exam | null> {
    const activationCode = getActivationCode();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-activation-code': activationCode || ''
            },
            body: JSON.stringify(params)
        });

        const data = await response.json();
        if (data.success) {
            return data.exam;
        }
        return null;
    } catch (error) {
        console.error('[Proxy] createExam error:', error);
        return null;
    }
}

/**
 * 更新考试信息
 */
export async function updateExam(id: string, params: Partial<Exam>): Promise<Exam | null> {
    const activationCode = getActivationCode();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-activation-code': activationCode || ''
            },
            body: JSON.stringify(params)
        });

        const data = await response.json();
        if (data.success) {
            return data.exam;
        }
        return null;
    } catch (error) {
        console.error('[Proxy] updateExam error:', error);
        return null;
    }
}

/**
 * 删除考试
 */
export async function deleteExam(id: string): Promise<boolean> {
    const activationCode = getActivationCode();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams/${id}`, {
            method: 'DELETE',
            headers: {
                'x-activation-code': activationCode || ''
            }
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[Proxy] deleteExam error:', error);
        return false;
    }
}

// ==================== 评分细则同步 ====================

export interface RubricRecord {
    questionKey: string;
    rubric: string;
    updatedAt: string;
    examId?: string | null;
}

/**
 * 保存评分细则到后端服务器
 */
export async function saveRubricToServer(questionKey: string, rubric: string, examId?: string | null): Promise<boolean> {
    if (!questionKey || !rubric?.trim()) {
        console.warn('[Proxy] saveRubricToServer: 参数无效');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/rubric`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-activation-code': getActivationCode() || '',
                'x-device-id': getDeviceId()
            },
            body: JSON.stringify({
                questionKey,
                rubric,
                examId
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
            `${API_BASE_URL}/api/rubric?questionKey=${encodeURIComponent(questionKey)}`,
            {
                method: 'GET',
                headers: {
                    'x-activation-code': getActivationCode() || '',
                    'x-device-id': getDeviceId()
                }
            }
        );

        const data = await response.json();

        if (data.success && data.rubric) {
            console.log('[Proxy] 从服务器加载评分细则:', questionKey);
            // 后端返回的是 RubricJSON 对象，这里可能需要转回字符串或直接返回
            // 为兼容旧版，如果返回的是对象，我们转为字符串
            return typeof data.rubric === 'string' ? data.rubric : JSON.stringify(data.rubric);
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
export async function loadAllRubricsFromServer(examId?: string): Promise<RubricRecord[]> {
    try {
        let url = `${API_BASE_URL}/api/rubric`;
        if (examId) url += `?examId=${encodeURIComponent(examId)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-activation-code': getActivationCode() || '',
                'x-device-id': getDeviceId()
            }
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.rubrics)) {
            console.log('[Proxy] 从服务器加载评分细则列表:', data.rubrics.length, '条');
            return data.rubrics.map((r: any) => ({
                questionKey: r.questionId,
                rubric: '', // 列表不返回详情
                updatedAt: r.updatedAt,
                examId: r.examId
            }));
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

