import type { RubricJSONV3, StrategyType } from '@/types/rubric-v3';
import { getDeviceId } from '@/services/proxyService';

// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';

type TemplateScope = 'user' | 'system' | 'all';
export type TemplateLifecycleStatus = 'draft' | 'published';

export interface RubricTemplate {
    id: string;
    scope: 'user' | 'system';
    activationCode: string | null;
    questionKey: string | null;
    lifecycleStatus: TemplateLifecycleStatus;
    subject: string | null;
    grade: string | null;
    questionType: string | null;
    strategyType: StrategyType;
    version: string;
    metadata: RubricJSONV3['metadata'] | null;
    content: RubricJSONV3['content'] | null;
    createdAt: string;
    updatedAt: string;
}

function getActivationCode(): string | null {
    return localStorage.getItem('activation_code');
}

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': getDeviceId()
    };
    const activationCode = getActivationCode();
    if (activationCode) {
        headers['x-activation-code'] = activationCode;
    }
    return headers;
}

export async function fetchRubricTemplates(params?: {
    scope?: TemplateScope;
    subject?: string;
    grade?: string;
    questionType?: string;
    strategyType?: StrategyType;
    lifecycleStatus?: TemplateLifecycleStatus;
}): Promise<RubricTemplate[]> {
    const search = new URLSearchParams();
    if (params?.scope) search.set('scope', params.scope);
    if (params?.subject) search.set('subject', params.subject);
    if (params?.grade) search.set('grade', params.grade);
    if (params?.questionType) search.set('questionType', params.questionType);
    if (params?.strategyType) search.set('strategyType', params.strategyType);
    if (params?.lifecycleStatus) search.set('lifecycleStatus', params.lifecycleStatus);

    const response = await fetch(`${API_BASE_URL}/api/rubric/templates?${search.toString()}`, {
        method: 'GET',
        headers: buildHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || '获取模板失败');
    }
    return data.data?.templates || [];
}

export async function createRubricTemplate(
    rubric: RubricJSONV3,
    scope: Exclude<TemplateScope, 'all'> = 'user',
    options?: {
        questionKey?: string | null;
        lifecycleStatus?: TemplateLifecycleStatus;
    }
): Promise<RubricTemplate> {
    const response = await fetch(`${API_BASE_URL}/api/rubric/templates`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
            scope,
            template: rubric,
            questionKey: options?.questionKey ?? null,
            lifecycleStatus: options?.lifecycleStatus ?? 'draft'
        })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || '创建模板失败');
    }
    return data.data?.template;
}

export async function updateRubricTemplateLifecycle(
    id: string,
    lifecycleStatus: TemplateLifecycleStatus
): Promise<RubricTemplate> {
    const response = await fetch(`${API_BASE_URL}/api/rubric/templates`, {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify({
            id,
            lifecycleStatus
        })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || '更新模板状态失败');
    }
    return data.data?.template;
}

export async function deleteRubricTemplate(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/rubric/templates?id=${id}`, {
        method: 'DELETE',
        headers: buildHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || '删除模板失败');
    }
}

export async function recommendRubricTemplates(payload: {
    subject?: string;
    questionType?: string;
    strategyType?: StrategyType;
    keywords?: string[];
    answerText?: string;
    questionText?: string;
}): Promise<RubricTemplate[]> {
    const response = await fetch(`${API_BASE_URL}/api/ai/rubric/recommend`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || '获取推荐模板失败');
    }
    return data.data?.templates || [];
}
