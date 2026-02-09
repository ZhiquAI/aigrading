/**
 * debug-utils.ts - 调试工具模块
 * 
 * 提供统一的调试日志功能，帮助追踪 AI 批改流程
 * 打开 Chrome DevTools 的 Console 面板即可查看
 */

// ==================== 调试开关 ====================

// 设置为 true 开启详细调试日志
export const DEBUG_MODE = true;

// 各模块调试开关
export const DEBUG_FLAGS = {
    api: true,       // API 请求/响应
    grading: true,   // 批改流程
    rubric: true,    // 评分细则
    store: false,    // 状态管理 (默认关闭，太多日志)
    timing: true,    // 性能计时
};

// ==================== 调试工具函数 ====================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogColors {
    [key: string]: string;
}

const COLORS: LogColors = {
    api: '#4CAF50',      // 绿色
    grading: '#2196F3',  // 蓝色
    rubric: '#FF9800',   // 橙色
    store: '#9C27B0',    // 紫色
    timing: '#00BCD4',   // 青色
};

/**
 * 格式化输出调试日志
 */
export function debugLog(
    module: keyof typeof DEBUG_FLAGS,
    message: string,
    data?: unknown,
    level: LogLevel = 'info'
): void {
    if (!DEBUG_MODE || !DEBUG_FLAGS[module]) return;

    const color = COLORS[module] || '#888';
    const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });

    const prefix = `%c[${module.toUpperCase()}]%c ${timestamp}`;
    const prefixStyles = [
        `color: white; background: ${color}; padding: 2px 6px; border-radius: 3px; font-weight: bold;`,
        'color: #888; font-size: 11px;'
    ];

    const logMethod = level === 'error' ? console.error
        : level === 'warn' ? console.warn
            : level === 'debug' ? console.debug
                : console.log;

    if (data !== undefined) {
        logMethod(prefix, ...prefixStyles, message, data);
    } else {
        logMethod(prefix, ...prefixStyles, message);
    }
}

// ==================== 性能计时器 ====================

const timers = new Map<string, number>();

/**
 * 开始计时
 */
export function startTimer(label: string): void {
    if (!DEBUG_MODE || !DEBUG_FLAGS.timing) return;
    timers.set(label, performance.now());
    debugLog('timing', `⏱️ 开始计时: ${label}`);
}

/**
 * 结束计时并输出
 */
export function endTimer(label: string): number {
    if (!DEBUG_MODE || !DEBUG_FLAGS.timing) return 0;

    const startTime = timers.get(label);
    if (!startTime) {
        debugLog('timing', `⚠️ 计时器 "${label}" 未找到`, undefined, 'warn');
        return 0;
    }

    const duration = performance.now() - startTime;
    timers.delete(label);

    const formattedDuration = duration > 1000
        ? `${(duration / 1000).toFixed(2)}s`
        : `${duration.toFixed(0)}ms`;

    debugLog('timing', `⏱️ ${label}: ${formattedDuration}`);
    return duration;
}

// ==================== API 调试助手 ====================

/**
 * 记录 API 请求
 */
export function logAPIRequest(
    endpoint: string,
    method: string,
    body?: Record<string, unknown>
): void {
    debugLog('api', `🚀 ${method} ${endpoint}`, {
        ...(body && { bodyPreview: summarizeBody(body) })
    });
}

/**
 * 记录 API 响应
 */
export function logAPIResponse(
    endpoint: string,
    status: number,
    data?: unknown,
    duration?: number
): void {
    const emoji = status >= 200 && status < 300 ? '✅' : '❌';
    debugLog('api', `${emoji} Response [${status}] ${endpoint}`, {
        ...(duration && { duration: `${duration.toFixed(0)}ms` }),
        ...(data && { dataPreview: summarizeData(data) })
    });
}

/**
 * 记录 API 错误
 */
export function logAPIError(endpoint: string, error: unknown): void {
    debugLog('api', `❌ Error: ${endpoint}`, error, 'error');
}

// ==================== 批改流程调试 ====================

/**
 * 记录批改开始
 */
export function logGradingStart(rubricId: string, imageSize: number): void {
    startTimer('grading-total');
    debugLog('grading', '📝 开始批改', {
        rubricId,
        imageSize: `${(imageSize / 1024).toFixed(1)}KB`
    });
}

/**
 * 记录批改流式响应
 */
export function logGradingChunk(chunkIndex: number, chunkLength: number): void {
    // 每 10 个 chunk 记录一次，避免日志过多
    if (chunkIndex % 10 === 0) {
        debugLog('grading', `📦 收到 chunk #${chunkIndex}`, { length: chunkLength }, 'debug');
    }
}

/**
 * 记录批改完成
 */
export function logGradingComplete(result: { score: number; maxScore: number }): void {
    const duration = endTimer('grading-total');
    debugLog('grading', '✅ 批改完成', {
        score: `${result.score}/${result.maxScore}`,
        duration: `${(duration / 1000).toFixed(2)}s`
    });
}

/**
 * 记录批改错误
 */
export function logGradingError(error: unknown): void {
    endTimer('grading-total');
    debugLog('grading', '❌ 批改失败', error, 'error');
}

// ==================== 辅助函数 ====================

/**
 * 摘要化请求体 (避免日志过长)
 */
function summarizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const summary: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
        if (key === 'messages' && Array.isArray(value)) {
            summary[key] = `[${value.length} messages]`;
        } else if (typeof value === 'string' && value.length > 100) {
            summary[key] = value.substring(0, 100) + '...';
        } else if (typeof value === 'string' && value.startsWith('data:image')) {
            summary[key] = '[Base64 Image]';
        } else {
            summary[key] = value;
        }
    }

    return summary;
}

/**
 * 摘要化响应数据
 */
function summarizeData(data: unknown): unknown {
    if (typeof data === 'string') {
        return data.length > 200 ? data.substring(0, 200) + '...' : data;
    }
    if (typeof data === 'object' && data !== null) {
        const str = JSON.stringify(data);
        return str.length > 300 ? str.substring(0, 300) + '...' : data;
    }
    return data;
}

// ==================== 全局调试命令 ====================

/**
 * 将调试工具挂载到 window 对象，方便在控制台使用
 */
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).aiDebug = {
        // 查看当前调试状态
        status: () => {
            console.log('🔧 AI Grading 调试状态:');
            console.log('  DEBUG_MODE:', DEBUG_MODE);
            console.log('  DEBUG_FLAGS:', DEBUG_FLAGS);
        },

        // 开启/关闭模块调试
        toggle: (module: keyof typeof DEBUG_FLAGS) => {
            DEBUG_FLAGS[module] = !DEBUG_FLAGS[module];
            console.log(`🔧 ${module} 调试: ${DEBUG_FLAGS[module] ? '开启' : '关闭'}`);
        },

        // 开启所有调试
        enableAll: () => {
            Object.keys(DEBUG_FLAGS).forEach(key => {
                (DEBUG_FLAGS as Record<string, boolean>)[key] = true;
            });
            console.log('🔧 所有调试已开启');
        },

        // 关闭所有调试
        disableAll: () => {
            Object.keys(DEBUG_FLAGS).forEach(key => {
                (DEBUG_FLAGS as Record<string, boolean>)[key] = false;
            });
            console.log('🔧 所有调试已关闭');
        },

        // 查看帮助
        help: () => {
            console.log(`
🔧 AI Grading 调试命令：

  aiDebug.status()           - 查看当前调试状态
  aiDebug.toggle('api')      - 开启/关闭 API 调试
  aiDebug.toggle('grading')  - 开启/关闭批改流程调试  
  aiDebug.toggle('rubric')   - 开启/关闭评分细则调试
  aiDebug.toggle('timing')   - 开启/关闭性能计时
  aiDebug.enableAll()        - 开启所有调试
  aiDebug.disableAll()       - 关闭所有调试
            `);
        }
    };

    // 启动时输出提示
    console.log('%c🔧 AI Grading 调试工具已加载', 'color: #4CAF50; font-weight: bold;');
    console.log('%c   输入 aiDebug.help() 查看可用命令', 'color: #888;');
}
