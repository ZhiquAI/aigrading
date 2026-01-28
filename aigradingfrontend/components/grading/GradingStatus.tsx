/**
 * GradingStatus.tsx - 批改状态显示
 * 
 * 从 GradingView.tsx 拆分
 * 显示当前批改状态、题目信息和进度
 */

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, XCircle, Clock, Wifi } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/StatusIndicator';

export type StatusType = 'idle' | 'loading' | 'success' | 'error' | 'warning' | 'scanning';

interface GradingStatusProps {
    status: StatusType;
    message?: string;
    questionNo?: string;
    studentName?: string;
    progress?: { current: number; total: number };
    isApiConnected?: boolean;
    onRetry?: () => void;
}

export const GradingStatus: React.FC<GradingStatusProps> = ({
    status,
    message,
    questionNo,
    studentName,
    progress,
    isApiConnected = true,
    onRetry
}) => {
    const getStatusIcon = () => {
        switch (status) {
            case 'loading':
            case 'scanning':
                return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusBg = () => {
        switch (status) {
            case 'loading':
            case 'scanning':
                return 'bg-blue-50 border-blue-200';
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className={`rounded-xl border p-3 ${getStatusBg()}`}>
            <div className="flex items-start gap-3">
                {/* 状态图标 */}
                <div className="shrink-0 mt-0.5">
                    {getStatusIcon()}
                </div>

                {/* 状态信息 */}
                <div className="flex-1 min-w-0">
                    {/* 题目和学生信息 */}
                    {(questionNo || studentName) && (
                        <div className="flex items-center gap-2 mb-1">
                            {questionNo && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                    第 {questionNo} 题
                                </span>
                            )}
                            {studentName && (
                                <span className="text-sm font-medium text-gray-700 truncate">
                                    {studentName}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 状态消息 */}
                    {message && (
                        <p className="text-sm text-gray-600">{message}</p>
                    )}

                    {/* 进度条 */}
                    {progress && progress.total > 0 && (
                        <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>批改进度</span>
                                <span>{progress.current}/{progress.total}</span>
                            </div>
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* API 连接状态 */}
                <div className="shrink-0">
                    <StatusIndicator
                        status={isApiConnected ? 'success' : 'error'}
                        label={isApiConnected ? 'API' : '离线'}
                    />
                </div>
            </div>

            {/* 重试按钮 */}
            {status === 'error' && onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-2 w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
                >
                    点击重试
                </button>
            )}
        </div>
    );
};

export default GradingStatus;
