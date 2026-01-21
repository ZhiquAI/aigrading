/**
 * config-service.ts - 配置管理服务
 * 
 * 负责应用配置的加载、保存和验证
 * 从 geminiService.ts 拆分
 */

import { AppConfig, ModelProviderType } from '../types';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

// Default Configuration
const DEFAULT_CONFIG: AppConfig = {
    provider: 'google',
    endpoint: '',
    modelName: 'gemini-2.0-flash-exp',
    apiKey: ''
};

// Storage Keys
const STORAGE_KEY_CONFIG = 'app_model_config';

/**
 * 从 localStorage 或环境变量加载配置
 */
export function getAppConfig(): AppConfig {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
            const parsed = JSON.parse(saved) as AppConfig;
            // 自动解密 API Key
            if (parsed.apiKey && isEncrypted(parsed.apiKey)) {
                parsed.apiKey = decrypt(parsed.apiKey);
            }
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (e) {
        console.error('[getAppConfig] Failed to parse config:', e);
    }

    // Fallback: Check environment variable
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    return { ...DEFAULT_CONFIG, apiKey: envKey };
}

/**
 * 保存配置到 localStorage
 * API Key 会自动加密存储
 */
export function saveAppConfig(config: AppConfig): void {
    const toSave = { ...config };
    // 加密 API Key (避免重复加密)
    if (toSave.apiKey && !isEncrypted(toSave.apiKey)) {
        toSave.apiKey = encrypt(toSave.apiKey);
    }
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(toSave));
}

/**
 * 检查 API Key 是否已配置
 */
export function checkApiKeyConfigured(): boolean {
    const config = getAppConfig();
    if (config.provider === 'google') {
        // Google provider: Check both custom key and env
        return !!(config.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY);
    }
    return !!config.apiKey;
}

/**
 * 获取服务商默认配置
 */
export const PROVIDER_DEFAULTS: Record<ModelProviderType, { endpoint: string; model: string }> = {
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o'
    },
    google: {
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.0-flash-exp'
    },
    zhipu: {
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: 'glm-4.6v'
    },
    alibaba: {
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        model: 'qwen-vl-max'
    }
};

/**
 * 获取模型名称建议列表
 */
export const MODEL_SUGGESTIONS: Record<ModelProviderType, string[]> = {
    openai: [
        'gemini-3-flash-preview',
        'gemini-2.0-flash',
        'gpt-4o',
        'gpt-4o-mini',
        'o3-mini',
        'o1-preview'
    ],
    google: [
        'gemini-3-flash-preview',
        'gemini-3-pro-preview',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ],
    zhipu: ['glm-4.6v', 'glm-4.7', 'glm-4v-flash'],
    alibaba: ['qwen-vl-max', 'qwen-vl-plus', 'qwen3-vl-plus', 'qwen3-vl-flash']
};

/**
 * 获取服务商显示名称
 */
export const PROVIDER_NAMES: Record<ModelProviderType, string> = {
    openai: 'OpenAI',
    google: 'Google Gemini',
    zhipu: '智谱AI',
    alibaba: '阿里云百炼'
};

export { DEFAULT_CONFIG, STORAGE_KEY_CONFIG };

// ==================== 学科评分规则配置 ====================

import { SubjectRules, QuestionType, QuestionRule } from '../types';

const STORAGE_KEY_SUBJECT_RULES = 'app_subject_rules';

// 支持的学科列表
export const SUBJECT_LIST = ['历史', '语文', '政治', '地理', '数学', '物理', '化学', '生物', '英语'];

// 题型显示名称
export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
    fillBlank: '填空题',
    shortAnswer: '简答题',
    openEnded: '开放题'
};

// 默认学科规则
export const DEFAULT_SUBJECT_RULES: Record<string, SubjectRules> = {
    '历史': {
        subject: '历史',
        rules: {
            fillBlank: { enabled: true, rule: '错字不得分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '言之有理即可' }
        }
    },
    '语文': {
        subject: '语文',
        rules: {
            fillBlank: { enabled: true, rule: '错字扣1分，漏字扣1分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '言之有理即可' }
        }
    },
    '政治': {
        subject: '政治',
        rules: {
            fillBlank: { enabled: true, rule: '错字不得分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '言之有理即可' }
        }
    },
    '地理': {
        subject: '地理',
        rules: {
            fillBlank: { enabled: true, rule: '错字不得分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '言之有理即可' }
        }
    },
    '数学': {
        subject: '数学',
        rules: {
            fillBlank: { enabled: true, rule: '答案错误不得分' },
            shortAnswer: { enabled: true, rule: '按步骤给分' },
            openEnded: { enabled: true, rule: '方法正确即可' }
        }
    },
    '物理': {
        subject: '物理',
        rules: {
            fillBlank: { enabled: true, rule: '答案错误不得分，单位错误扣分' },
            shortAnswer: { enabled: true, rule: '按步骤给分' },
            openEnded: { enabled: true, rule: '原理正确即可' }
        }
    },
    '化学': {
        subject: '化学',
        rules: {
            fillBlank: { enabled: true, rule: '化学式错误不得分' },
            shortAnswer: { enabled: true, rule: '按步骤给分' },
            openEnded: { enabled: true, rule: '原理正确即可' }
        }
    },
    '生物': {
        subject: '生物',
        rules: {
            fillBlank: { enabled: true, rule: '错字不得分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '言之有理即可' }
        }
    },
    '英语': {
        subject: '英语',
        rules: {
            fillBlank: { enabled: true, rule: '拼写错误不得分' },
            shortAnswer: { enabled: true, rule: '按点给分' },
            openEnded: { enabled: true, rule: '表达正确即可' }
        }
    }
};

/**
 * 获取当前学科
 */
export function getCurrentSubject(): string {
    const config = getAppConfig();
    return config.currentSubject || '历史';
}

/**
 * 设置当前学科
 */
export function setCurrentSubject(subject: string): void {
    const config = getAppConfig();
    config.currentSubject = subject;
    saveAppConfig(config);
}

/**
 * 获取学科规则
 */
export function getSubjectRules(subject?: string): SubjectRules {
    const targetSubject = subject || getCurrentSubject();

    try {
        const saved = localStorage.getItem(STORAGE_KEY_SUBJECT_RULES);
        if (saved) {
            const allRules = JSON.parse(saved) as Record<string, SubjectRules>;
            if (allRules[targetSubject]) {
                return allRules[targetSubject];
            }
        }
    } catch (e) {
        console.error('[getSubjectRules] Error:', e);
    }

    // 返回默认规则
    return DEFAULT_SUBJECT_RULES[targetSubject] || DEFAULT_SUBJECT_RULES['历史'];
}

/**
 * 保存学科规则
 */
export function saveSubjectRules(rules: SubjectRules): void {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_SUBJECT_RULES);
        const allRules = saved ? JSON.parse(saved) : {};
        allRules[rules.subject] = rules;
        localStorage.setItem(STORAGE_KEY_SUBJECT_RULES, JSON.stringify(allRules));
    } catch (e) {
        console.error('[saveSubjectRules] Error:', e);
    }
}

/**
 * 生成评分规则提示文本（用于 AI 提示词）
 */
export function generateRulesPrompt(subject?: string): string {
    const rules = getSubjectRules(subject);
    const parts: string[] = [];

    if (rules.rules.fillBlank.enabled) {
        parts.push(`填空题：${rules.rules.fillBlank.rule}`);
    }
    if (rules.rules.shortAnswer.enabled) {
        parts.push(`简答题：${rules.rules.shortAnswer.rule}`);
    }
    if (rules.rules.openEnded.enabled) {
        parts.push(`开放题：${rules.rules.openEnded.rule}`);
    }

    return parts.join('，');
}
