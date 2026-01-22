import React, { useEffect, useState, Suspense, lazy } from 'react';
import { PenTool, BarChart3, Settings, History, Loader2 } from 'lucide-react';
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
  const { isDark } = useTheme();

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

  // 检查是否需要显示引导
  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding());
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
    const loadData = async () => {
      const savedRubric = await storage.getItem('app_rubric_content');
      const savedStrategy = await storage.getItem('app_grading_strategy');

      if (savedRubric) {
        setRubricContent(savedRubric);
        setIsRubricConfigured(true);
      }

      if (savedStrategy) {
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

  useEffect(() => {
    loadConfiguredQuestions();
  }, [currentQuestionKey]);

  // Proactively derive questionKey from active tab
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    let port: any = null;
    getActiveTabId().then(tabId => {
      if (tabId) {
        try {
          port = chrome.tabs.connect(tabId, { name: 'sidepanel-connection' });
        } catch (e) {
          // ignore
        }
      }
    });

    let cancelled = false;
    const tick = async () => {
      const qk = await fetchPageMetaQuestionKey();
      if (!cancelled && qk && qk !== detectedQuestionKey) {
        setDetectedQuestionKey(qk);
        if (manualQuestionKey) setManualQuestionKey(null);
      }
    };
    tick();
    const timer = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (port) port.disconnect();
    };
  }, []);

  // 当 currentQuestionKey 变化时加载评分细则
  useEffect(() => {
    const initRubric = async () => {
      await useAppStore.getState().loadRubricForQuestion(currentQuestionKey || '');
    };
    initRubric();
  }, [currentQuestionKey]);

  const handleSaveRubric = async (text: string) => {
    if (text.trim().length > 0) {
      setIsRubricConfigured(true);
      setRubricContent(text);
      let qk = currentQuestionKey;
      if (!qk) {
        qk = await fetchPageMetaQuestionKey();
        if (qk) setDetectedQuestionKey(qk);
      }
      const key = qk ? getRubricStorageKey(qk) : 'app_rubric_content';
      await storage.setItem(key, text);
    }
    setIsRubricDrawerOpen(false);
  };

  const handleStrategyChange = async (newStrategy: GradingStrategy) => {
    setGradingStrategy(newStrategy);
    await storage.setItem('app_grading_strategy', newStrategy);
  };

  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
    if (isRubricDrawerOpen) {
      setIsRubricDrawerOpen(false);
    }
  };

  return (
    <AppProvider>
      <ToastProvider>
        <div className={`fixed right-0 top-0 w-full h-screen shadow-2xl flex flex-col z-50 font-sans ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
          {/* Top Navigation */}
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
              <NavButton
                isActive={activeTab === Tab.Settings}
                onClick={() => handleTabChange(Tab.Settings)}
                icon={Settings}
                label="设置"
              />
            </div>
          </nav>

          {/* Main Content Area */}
          <div className={`flex-1 relative overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            {/* GradingView */}
            <div className={`absolute inset-0 flex flex-col ${activeTab === Tab.Grading ? 'z-10' : 'z-0 invisible'}`}>
              <Suspense fallback={<LoadingFallback />}>
                <GradingView
                  onOpenRubric={() => setIsRubricDrawerOpen(true)}
                  isRubricConfigured={isRubricConfigured}
                  currentRubric={rubricContent}
                  gradingStrategy={gradingStrategy}
                  onQuestionKeyChange={(key) => {
                    if (key && key !== manualQuestionKey) {
                      setManualQuestionKey(key);
                    }
                  }}
                  onSaveRubric={handleSaveRubric}
                  configuredQuestions={configuredQuestions}
                  onOpenSettings={() => setActiveTab(Tab.Settings)}
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

            {/* Settings View */}
            {activeTab === Tab.Settings && (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <SettingsView
                    onOpenRubric={() => setIsRubricDrawerOpen(true)}
                    isRubricConfigured={isRubricConfigured}
                    currentStrategy={gradingStrategy}
                    onStrategyChange={handleStrategyChange}
                    onEditRubric={(questionKey, rubric) => {
                      setManualQuestionKey(questionKey.replace('app_rubric_content:', ''));
                      setRubricContent(rubric);
                      setIsRubricConfigured(true);
                      setIsRubricDrawerOpen(true);
                    }}
                    onRubricDeleted={() => {
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