/**
 * 结构化日志工具
 * 在开发环境下提供易读的控制台输出，在生产环境下提供 JSON 格式输出
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
    service?: string;
    traceId?: string;
    [key: string]: any;
}

class Logger {
    private serviceName: string;

    constructor(serviceName: string = 'backend') {
        this.serviceName = serviceName;
    }

    private log(level: LogLevel, message: string, data?: any, context?: LogContext) {
        const timestamp = new Date().toISOString();
        const isProduction = process.env.NODE_ENV === 'production';

        const payload = {
            timestamp,
            level,
            service: context?.service || this.serviceName,
            traceId: context?.traceId,
            message,
            data,
            ...context
        };

        if (isProduction) {
            console.log(JSON.stringify(payload));
        } else {
            const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[32m';
            const reset = '\x1b[0m';
            console.log(`${color}[${level}]${reset} ${message}`, data ? data : '');
        }
    }

    debug(message: string, data?: any, context?: LogContext) {
        this.log('DEBUG', message, data, context);
    }

    info(message: string, data?: any, context?: LogContext) {
        this.log('INFO', message, data, context);
    }

    warn(message: string, data?: any, context?: LogContext) {
        this.log('WARN', message, data, context);
    }

    error(message: string, error?: any, context?: LogContext) {
        const errorData = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : error;
        this.log('ERROR', message, errorData, context);
    }
}

export const logger = new Logger();

// 为每个请求创建带上下文的 Logger
export function createRequestLogger(req: Request | NextRequest) {
    const traceId = req.headers.get('x-trace-id') || Math.random().toString(36).substring(7);
    return {
        info: (msg: string, data?: any) => logger.info(msg, data, { traceId }),
        warn: (msg: string, data?: any) => logger.warn(msg, data, { traceId }),
        error: (msg: string, err?: any) => logger.error(msg, err, { traceId }),
        debug: (msg: string, data?: any) => logger.debug(msg, data, { traceId }),
    };
}

import { NextRequest } from 'next/server';
