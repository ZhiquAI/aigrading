import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // 回退到 alert（用于尚未迁移的场景）
        return {
            showToast: (message: string) => alert(message)
        };
    }
    return context;
};

// 全局 toast 函数（用于非组件调用）
let globalShowToast: ((message: string, type?: ToastType) => void) | null = null;

export const toast = {
    show: (message: string, type: ToastType = 'info') => {
        if (globalShowToast) {
            globalShowToast(message, type);
        } else {
            alert(message);
        }
    },
    success: (message: string) => toast.show(message, 'success'),
    error: (message: string) => toast.show(message, 'error'),
    info: (message: string) => toast.show(message, 'info'),
    warning: (message: string) => toast.show(message, 'warning'),
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const bgColors = {
        success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
        error: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
        warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
        info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    };

    return (
        <div
            role="alert"
            aria-live="polite"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${bgColors[toast.type]}`}
        >
            <span aria-hidden="true">{icons[toast.type]}</span>
            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                {toast.message}
            </span>
            <button
                onClick={onClose}
                aria-label="关闭通知"
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </button>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // 自动消失
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // 注册全局函数
    React.useEffect(() => {
        globalShowToast = showToast;
        return () => {
            globalShowToast = null;
        };
    }, [showToast]);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast 容器 */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onClose={() => removeToast(t.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
