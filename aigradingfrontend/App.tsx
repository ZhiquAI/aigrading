import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { AppProvider } from './contexts/AppContext';
import { useAppStore } from './stores/useAppStore';
import ModernLayout from './src/components/v2/layout/ModernLayout';
import { MandatoryActivationGate } from './src/components/v2/onboarding/MandatoryActivationGate';
import { getUsageInfo as fetchUsageFromBackend } from './services/proxyService';
import { OnboardingGuide, shouldShowOnboarding } from './components/OnboardingGuide';

// 加载占位组件
const LoadingFallback: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  </div>
);

const App: React.FC = () => {

  // 新手引导状态
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 检查是否需要显示引导
  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  // 刷新使用额度（提取为可复用函数）
  const refreshUsageInfo = useCallback(async () => {
    try {
      const info = await fetchUsageFromBackend();
      // 此处V2已集成，暂不处理
    } catch {
      // 后端获取失败时保持默认值
    }
  }, []);

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