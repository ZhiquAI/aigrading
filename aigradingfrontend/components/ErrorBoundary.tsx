import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

/**
 * React Error Boundary组件
 * 捕获子组件树中的JavaScript错误,记录错误并展示降级UI
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // 更新state以渲染降级UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 记录错误到控制台
        console.error('[ErrorBoundary] 捕获到组件错误:', error, errorInfo);

        // 调用可选的错误处理回调
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // 更新state以包含错误详情
        this.setState({ error, errorInfo });
    }

    handleReset = () => {
        // 重置错误状态,尝试重新渲染组件
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleForceReload = () => {
        // 清除持久化状态并强制刷新页面
        if (confirm('是否进行强制刷新？这可能会由于清除缓存而解决某些持久化错误。')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 bg-slate-50/50 backdrop-blur-sm selection:bg-red-100">
                    <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 text-center animate-in zoom-in-95 duration-300">
                        {/* Error Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse"></div>
                                <div className="relative w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100">
                                    <AlertTriangle className="w-10 h-10 text-red-500" />
                                </div>
                            </div>
                        </div>

                        {/* Text */}
                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">
                            糟糕，出错了
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-8">
                            应用程序遇到了预期之外的错误。请尝试刷新以解决问题。
                        </p>

                        {/* Technical Details (Collapsible) */}
                        <div className="text-left mb-8">
                            <details className="group">
                                <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                                    错误诊断信息
                                </summary>
                                <div className="mt-4 p-4 bg-slate-900 rounded-xl text-[10px] text-red-400 font-mono overflow-auto max-h-40 leading-normal border border-slate-800 shadow-inner">
                                    <div className="font-bold mb-1">Error: {this.state.error?.message}</div>
                                    <div className="opacity-60 whitespace-pre-wrap">
                                        {this.state.errorInfo?.componentStack}
                                    </div>
                                </div>
                            </details>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-slate-200"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                尝试恢复并重新加载
                            </button>

                            <button
                                onClick={this.handleForceReload}
                                className="w-full h-10 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                            >
                                强制刷新 (清除缓存)
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-[11px] font-bold text-slate-300 tracking-widest uppercase">
                        AI Grading Assistant • System Recovery
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
