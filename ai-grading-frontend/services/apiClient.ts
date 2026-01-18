/**
 * API客户端
 * 封装与后端的通信
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api/client';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    code?: string;
}

export class APIClient {
    private deviceId: string;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
    }

    /**
     * 验证激活码
     */
    async verifyActivation(code: string): Promise<ApiResponse> {
        try {
            const res = await fetch(`${API_BASE}/activation/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-ID': this.deviceId
                },
                body: JSON.stringify({ code })
            });

            return await res.json();
        } catch (error) {
            console.error('[APIClient] verifyActivation error:', error);
            return {
                success: false,
                message: '网络错误，请检查后端服务是否启动'
            };
        }
    }

    /**
     * 查询额度
     */
    async checkQuota(): Promise<ApiResponse> {
        try {
            const res = await fetch(
                `${API_BASE}/quota/check?deviceId=${this.deviceId}`,
                {
                    headers: {
                        'X-Device-ID': this.deviceId
                    }
                }
            );

            return await res.json();
        } catch (error) {
            console.error('[APIClient] checkQuota error:', error);
            return {
                success: false,
                message: '网络错误，请检查后端服务是否启动'
            };
        }
    }

    /**
     * 消费额度
     */
    async consumeQuota(metadata?: {
        questionType?: string;
        model?: string;
        [key: string]: any;
    }): Promise<ApiResponse> {
        try {
            const res = await fetch(`${API_BASE}/quota/consume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-ID': this.deviceId
                },
                body: JSON.stringify({
                    amount: 1,
                    metadata
                })
            });

            return await res.json();
        } catch (error) {
            console.error('[APIClient] consumeQuota error:', error);
            return {
                success: false,
                message: '网络错误，请检查后端服务是否启动'
            };
        }
    }
}

// 创建单例实例（需要在有deviceId后初始化）
let apiClientInstance: APIClient | null = null;

export function initAPIClient(deviceId: string) {
    apiClientInstance = new APIClient(deviceId);
    return apiClientInstance;
}

export function getAPIClient(): APIClient {
    if (!apiClientInstance) {
        throw new Error('APIClient not initialized. Call initAPIClient first.');
    }
    return apiClientInstance;
}
