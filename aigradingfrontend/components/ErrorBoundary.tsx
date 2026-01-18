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

    render() {
        if (this.state.hasError) {
            // 如果提供了自定义fallback,使用它
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // 默认错误UI
            return (
                <div className="flex items-center justify-center min-h-[200px] p-6 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-center max-w-md">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                            组件加载失败
                        </h3>

                        <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                            {this.state.error?.message || '未知错误'}
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                            <details className="mt-4 text-left">
                                <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:underline">
                                    查看错误详情
                                </summary>
                                <pre className="mt-2 p-3 bg-red-50 dark:bg-red-950 rounded text-[10px] text-red-800 dark:text-red-200 overflow-x-auto font-mono">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors active:scale-95"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            重新加载
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
