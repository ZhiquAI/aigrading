/**
 * services/index.ts - 服务层统一导出
 * 
 * 保持向下兼容性：从 geminiService 重新导出所有函数
 * 同时也导出新拆分的服务模块
 */

// 原有 geminiService 的所有导出（保持兼容）
export * from './geminiService';

// ==================== 新拆分的服务模块 ====================

// 配置管理服务
export {
    getAppConfig,
    saveAppConfig,
    checkApiKeyConfigured,
    PROVIDER_DEFAULTS,
    MODEL_SUGGESTIONS,
    PROVIDER_NAMES
} from './config-service';

// AI 调用服务（从 gemini-core 导出）
export {
    callGemini as getGoogleClient,
    testGeminiConnection as testConnection
} from './gemini-core';

export {
    callOpenAI as callOpenAICompatible,
    callOpenAIMultiImage as callOpenAICompatibleMultiImage
} from './openaiService';

// 评分细则服务
export {
    generateRubricFromImages,
    autoGenerateRubric,
    refineRubric
} from './rubric-service';


// 批改服务
export {
    assessStudentAnswer as gradeStudent,
    generateGradingInsight,
    getModelName
} from './grading-service';



// ==================== 独立模型服务 ====================

// OpenAI 服务（支持 OpenAI 官方及所有兼容 API）
export {
    callOpenAI,
    callOpenAIMultiImage,
    testOpenAIConnection,
    createOpenAIConfig,
    OPENAI_DEFAULTS
} from './openaiService';

export type { OpenAIConfig } from './openaiService';

// 智谱 AI 服务
export {
    callZhipu,
    callZhipuMultiImage,
    testZhipuConnection,
    validateZhipuApiKey,
    createZhipuConfig,
    ZHIPU_DEFAULTS
} from './zhipuService';

export type { ZhipuConfig } from './zhipuService';

// Gemini 核心服务
export {
    callGemini,
    callGeminiMultiImage,
    callGeminiText,
    testGeminiConnection,
    callGeminiWithSchema,
    createGeminiClient,
    getGeminiStrategyConfig,
    GEMINI_DEFAULTS,
    GEMINI_STRATEGY_CONFIG
} from './gemini-core';

export type { GeminiConfig } from './gemini-core';

export {
    callAI,
    callAIWithConfig,
    callAIMultiImage,
    callAIMultiImageWithConfig,
    testAIConnection,
    getProviderName,
    cleanJsonResponse
} from './ai-router';

export type { ModelProvider, AICallOptions } from './ai-router';

// 重新导出 GradingStrategy 类型（从 gemini-core，保持向后兼容）
export type { GradingStrategy } from './gemini-core';

// AI 错误处理
export {
    AIError,
    AIErrorType,
    ERROR_MESSAGES,
    parseAPIError,
    parseNetworkError
} from './ai-error';

// 重试队列服务
export {
    getPendingRequests,
    addToRetryQueue,
    removeFromQueue,
    getRequestWithImage,
    cleanupExpiredRequests,
    getQueueStats
} from './retry-queue';

export type { PendingRequest } from './retry-queue';
