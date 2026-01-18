import React, { useEffect, useState, Suspense, lazy, useCallback } from 'react';
import { PenTool, BarChart3, Settings, History, Loader2, Crown, Zap } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import UnifiedRubricEditor from './components/UnifiedRubricEditor';
import { ToastProvider } from './components/Toast';
import { AppProvider } from './contexts/AppContext';
import { Tab } from './types';
import { GradingStrategy } from './services/geminiService';
import { storage } from './utils/storage';
import { useTheme } from './hooks/useTheme';
import { useAppStore } from './stores/useAppStore';
import { OnboardingGuide, shouldShowOnboarding } from './components/OnboardingGuide';
import { getUsageInfo as fetchUsageFromBackend } from './services/proxyService';
import { ActivationView } from './components/ActivationView';
import { Button } from './components/ui';

// 付费系统组件
import QuotaDisplay from './components/QuotaDisplay';
import ActivationModal from './components/ActivationModal';
import PurchasePage from './components/PurchasePage';

// 懒加载组件 - 提升首屏加载性能
const GradingView = lazy(() => import('./components/GradingView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const AnalysisView = lazy(() => import('./components/AnalysisView'));
const SettingsView = lazy(() => import('./components/SettingsView'));

// 加载占位组件
const LoadingFallback: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  </div>
);


const App: React.FC = () => {
  const { isDark } = useTheme(); // 订阅主题变化以触发重新渲染

  // 从 Zustand Store 获取状态和操作
  const {
    activeTab,
    setActiveTab,
    isRubricConfigured,
    setIsRubricConfigured,
    rubricContent,
    setRubricContent,
    detectedQuestionKey,
    setDetectedQuestionKey,
    manualQuestionKey,
    setManualQuestionKey,
    configuredQuestions,
    setConfiguredQuestions,
    isRubricDrawerOpen,
    setIsRubricDrawerOpen,
    gradingStrategy,
    setGradingStrategy,
    loadConfiguredQuestions
  } = useAppStore();

  // 计算当前题目 Key
  const currentQuestionKey = manualQuestionKey || detectedQuestionKey;

  // 新手引导状态
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 付费系统状态
  const [showActivation, setShowActivation] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);


  // 额度状态（从后端获取，不限时间和设备）
  const [usageInfo, setUsageInfo] = useState({ used: 0, limit: 300, remaining: 300 });

  // 检查是否需要显示引导
  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  // 刷新使用额度（提取为可复用函数）
  const refreshUsageInfo = useCallback(async () => {
    try {
      const info = await fetchUsageFromBackend();
      setUsageInfo({
        used: info.todayUsage,
        limit: info.dailyLimit,
        remaining: info.remaining
      });
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
  }, []);

  const getRubricStorageKey = (questionKey: string) => `app_rubric_content:${questionKey}`;

  const getActiveTabId = (): Promise<number | null> => {
    return new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        resolve(null);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        resolve(tabs[0]?.id ?? null);
      });
    });
  };

  const injectContentScript = async (tabId: number) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  const fetchPageMetaQuestionKey = async (): Promise<string | null> => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const tabId = await getActiveTabId();
    if (!tabId) return null;

    const send = (): Promise<any> =>
      new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_META' }, (res: any) => resolve(res));
      });

    let res = await send();
    if (chrome.runtime?.lastError) {
      const ok = await injectContentScript(tabId);
      if (!ok) return null;
      res = await send();
    }
    return res?.success ? (res?.meta?.questionKey ?? null) : null;
  };

  // --- Persistence Logic ---
  useEffect(() => {
    // Load from chrome.storage on mount
    const loadData = async () => {
      // Legacy/global rubric (kept for backward compatibility)
      const savedRubric = await storage.getItem('app_rubric_content');
      const savedStrategy = await storage.getItem('app_grading_strategy');

      console.log('[App] Loading saved data:', {
        hasRubric: !!savedRubric,
        rubricLength: savedRubric?.length,
        strategy: savedStrategy
      });

      if (savedRubric) {
        setRubricContent(savedRubric);
        setIsRubricConfigured(true); // legacy default
        console.log('[App] Rubric loaded successfully');
      } else {
        console.log('[App] No saved rubric found');
      }

      if (savedStrategy) {
        // Simple migration for legacy values
        if (savedStrategy === 'gpt4' || savedStrategy === 'dual') {
          setGradingStrategy('pro');
        } else if (savedStrategy === 'gemini') {
          setGradingStrategy('flash');
        } else {
          setGradingStrategy(savedStrategy as GradingStrategy);
        }
      }
    };

    loadData();
  }, [setGradingStrategy, setIsRubricConfigured, setRubricContent]);

  // 加载已配置评分细则的题目列表 - 使用 store 中的方法

  useEffect(() => {
    loadConfiguredQuestions();
  }, [currentQuestionKey]); // 当题目切换时刷新列表

  // Proactively derive questionKey from active tab without requiring a scan.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    // 建立长连接以实现生命周期管理 (当SidePanel关闭时自动清理高亮)
    let port: any = null;
    getActiveTabId().then(tabId => {
      if (tabId) {
        try {
          port = chrome.tabs.connect(tabId, { name: 'sidepanel-connection' });
          console.log('[App] Established cleanup connection to tab', tabId);
        } catch (e) {
          // ignore (content script might not be ready yet)
        }
      }
    });

    let cancelled = false;
    const tick = async () => {
      const qk = await fetchPageMetaQuestionKey();
      if (!cancelled && qk && qk !== detectedQuestionKey) {
        console.log('[App] Detected new questionKey:', qk);
        setDetectedQuestionKey(qk);
        if (manualQuestionKey) setManualQuestionKey(null);
      }
    };
    tick();
    const timer = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (port) {
        port.disconnect();
        console.log('[App] Disconnected cleanup connection');
      }
    };
  }, []);  // 只在挂载时启动，不依赖状态

  // 当 currentQuestionKey 变化时加载评分细则
  useEffect(() => {
    const initRubric = async () => {
      // 这里的 loadRubricForQuestion 已经包含了：
      // 1. 尝试从本地加载
      // 2. 本地没有则从后端加载并缓存
      // 3. 都没有则清空
      await useAppStore.getState().loadRubricForQuestion(currentQuestionKey || '');
    };
    initRubric();
  }, [currentQuestionKey]); // 依赖 currentQuestionKey

  const handleSaveRubric = async (text: string) => {
    if (text.trim().length > 0) {
      setIsRubricConfigured(true);
      setRubricContent(text);
      // Ensure we save into per-question key whenever possible (avoid "lost after refresh")
      let qk = currentQuestionKey;
      if (!qk) {
        qk = await fetchPageMetaQuestionKey();
        if (qk) setDetectedQuestionKey(qk);
      }
      const key = qk ? getRubricStorageKey(qk) : 'app_rubric_content';
      await storage.setItem(key, text); // Save
      console.log('[App] Rubric saved to chrome.storage:', {
        key,
        length: text.length,
        preview: text.substring(0, 50) + '...'
      });
    } else {
      console.warn('[App] Attempted to save empty rubric');
    }
    setIsRubricDrawerOpen(false);
  };

  const handleStrategyChange = async (newStrategy: GradingStrategy) => {
    setGradingStrategy(newStrategy);
    await storage.setItem('app_grading_strategy', newStrategy); // Save
  };

  // 页签切换处理函数 - 自动关闭子视图
  const handleTabChange = (newTab: Tab) => {
    console.log('[App] Switching tab to:', newTab);
    setActiveTab(newTab);
    // 关闭评分细则编辑器
    if (isRubricDrawerOpen) {
      setIsRubricDrawerOpen(false);
    }
  };

  return (
    <AppProvider>
      <ToastProvider>
        <div className={`fixed right-0 top-0 w-full h-screen shadow-2xl flex flex-col z-50 font-sans ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
          {/* Top Navigation - 精确匹配 design-specs/01-main-interface.html */}
          <nav className={`flex items-center px-2 shrink-0 z-20 shadow-sm h-[60px] ${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-100'}`}>
            <div className="flex flex-1 h-full items-end">
              <NavButton
                isActive={activeTab === Tab.Grading}
                onClick={() => handleTabChange(Tab.Grading)}
                icon={PenTool}
                label="批改"
              />
              <NavButton
                isActive={activeTab === Tab.History}
                onClick={() => handleTabChange(Tab.History)}
                icon={History}
                label="记录"
              />
              <NavButton
                isActive={activeTab === Tab.Analysis}
                onClick={() => handleTabChange(Tab.Analysis)}
                icon={BarChart3}
                label="分析"
              />
              {/* 额度显示作为导航项 */}
              <div className="flex-1 flex items-end h-full">
                <QuotaDisplay
                  onPurchaseClick={() => setShowPurchase(true)}
                  onActivateClick={() => setShowActivation(true)}
                />
              </div>
            </div>
          </nav>

          {/* Main Content Area */}
          <div className={`flex-1 relative overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            {/* GradingView: Keep mounted to preserve state/connection */}
            <div className={`absolute inset-0 flex flex-col ${activeTab === Tab.Grading ? 'z-10' : 'z-0 invisible'}`}>
              <Suspense fallback={<LoadingFallback />}>
                <GradingView
                  onOpenRubric={() => setIsRubricDrawerOpen(true)}
                  isRubricConfigured={isRubricConfigured}
                  currentRubric={rubricContent}
                  gradingStrategy={gradingStrategy}

                  onQuestionKeyChange={(key) => {
                    // 有效 key 时更新 manualQuestionKey，触发评分细则加载
                    // 这样无论是页面检测还是用户选择，都会正确加载评分细则
                    if (key && key !== manualQuestionKey) {
                      setManualQuestionKey(key);
                    }
                  }}
                  onSaveRubric={handleSaveRubric}
                  configuredQuestions={configuredQuestions}
                  onOpenSettings={() => setActiveTab(Tab.Settings)}
                  usageInfo={usageInfo}
                  onShowActivation={() => setShowActivation(true)}
                />
              </Suspense>
            </div>

            {/* History View */}
            {activeTab === Tab.History && (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <HistoryView />
                </Suspense>
              </ErrorBoundary>
            )}

            {/* Data Analysis View */}
            {activeTab === Tab.Analysis && (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <AnalysisView />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeTab === Tab.Settings && (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <SettingsView
                    onOpenRubric={() => setIsRubricDrawerOpen(true)}
                    isRubricConfigured={isRubricConfigured}
                    currentStrategy={gradingStrategy}
                    onStrategyChange={handleStrategyChange}
                    onOpenAdmin={() => window.open('http://localhost:3001/admin', '_blank')}
                    onEditRubric={(questionKey, rubric, questionHint) => {
                      // 设置当前题目和细则内容
                      setManualQuestionKey(questionKey.replace('app_rubric_content:', ''));
                      setRubricContent(rubric);
                      setIsRubricConfigured(true);
                      // 打开编辑器
                      setIsRubricDrawerOpen(true);
                    }}
                    onRubricDeleted={() => {
                      // 刷新已配置细则列表
                      loadConfiguredQuestions();
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {/* Unified Rubric Editor */}
            <UnifiedRubricEditor
              isOpen={isRubricDrawerOpen}
              onClose={() => setIsRubricDrawerOpen(false)}
              currentQuestionKey={currentQuestionKey}
              onSave={(rubric, questionKey) => {
                setRubricContent(rubric);
                setIsRubricConfigured(true);
                if (questionKey) {
                  setManualQuestionKey(questionKey);
                }
                setIsRubricDrawerOpen(false);
                loadConfiguredQuestions();
              }}
            />

            {/* 新手引导 */}
            <OnboardingGuide
              isOpen={showOnboarding}
              onClose={() => setShowOnboarding(false)}
              onComplete={() => setShowOnboarding(false)}
              onOpenSettings={() => setActiveTab(Tab.Settings)}
              onOpenRubric={() => setIsRubricDrawerOpen(true)}
            />

            {/* 新付费系统弹窗 */}
            {showActivation && (
              <ActivationModal
                onSuccess={() => {
                  setShowActivation(false);
                  // 触发额度刷新
                  window.dispatchEvent(new Event('quota_updated'));
                }}
                onClose={() => setShowActivation(false)}
              />
            )}

            {/* 购买页面弹窗 */}
            {showPurchase && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setShowPurchase(false)}>
                <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <PurchasePage
                    onActivateClick={() => {
                      setShowPurchase(false);
                      setShowActivation(true);
                    }}
                    onClose={() => setShowPurchase(false)}
                  />
                  <button
                    onClick={() => setShowPurchase(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-gray-600 text-[20px]">close</span>
                  </button>
                </div>
              </div>
            )}


          </div>
        </div>
      </ToastProvider>
    </AppProvider>
  );
};

const NavButton = ({ isActive, onClick, icon: Icon, label }: any) => (
  <button
    role="tab"
    aria-selected={isActive}
    aria-label={label}
    onClick={onClick}
    className={`flex-1 py-3.5 text-sm transition-all border-b-2 rounded-t-lg ${isActive
      ? 'font-bold text-blue-600 border-blue-600 bg-blue-50/30 dark:bg-blue-900/30'
      : 'font-medium text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
  >
    <div className="flex items-center justify-center gap-1.5">
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : ''}`} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  </button>
);

export default App;