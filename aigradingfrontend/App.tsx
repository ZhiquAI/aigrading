import React, { useEffect, useState, useCallback } from 'react';
import VConsole from 'vconsole';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { AppProvider } from './contexts/AppContext';
import { useAppStore } from './stores/useAppStore';
import ModernLayout from './src/components/v2/layout/ModernLayout';
import { MandatoryActivationGate } from './src/components/v2/onboarding/MandatoryActivationGate';
import { getUsageInfo as fetchUsageFromBackend } from './services/proxyService';
import { OnboardingGuide, shouldShowOnboarding } from './components/OnboardingGuide';
// 🔧 调试工具 - 在控制台输入 aiDebug.help() 查看使用方法
import './services/debug-utils';

// vConsole 全局单例 - 仅在开发环境下初始化一次
// 放在模块顶层，避免 HMR 时重复创建/销毁导致闪烁
let vConsoleInstance: VConsole | null = null;
if (import.meta.env.MODE === 'development' && !vConsoleInstance) {
  vConsoleInstance = new VConsole();
}

// 加载占位组件
const LoadingFallback: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 检查是否需要显示引导
  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  // 刷新使用额度（从 store 获取统一逻辑）
  const { syncQuota } = useAppStore();
  const refreshUsageInfo = useCallback(async () => {
    try {
      await syncQuota();
    } catch {
      // 保持静默
    }
  }, [syncQuota]);

  // 从后端获取全局使用额度
  useEffect(() => {
    refreshUsageInfo();

    // 每次批改后刷新（监听 grading_complete 事件）
    const handleGradingComplete = () => refreshUsageInfo();
    window.addEventListener('grading_complete', handleGradingComplete);

    // 定期刷新（每60秒）
    const interval = setInterval(refreshUsageInfo, 60000);

    return () => {
      window.removeEventListener('grading_complete', handleGradingComplete);
      clearInterval(interval);
    };
  }, [refreshUsageInfo]);

  // V2版本是默认版本，直接返回V2 UI
  return (
    <AppProvider>
      <ToastProvider>
        <MandatoryActivationGate>
          <ModernLayout />
        </MandatoryActivationGate>
      </ToastProvider>
    </AppProvider>
  );
};

export default App;