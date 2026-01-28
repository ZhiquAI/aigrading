import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Cpu, CheckCircle2, Circle, FileEdit, Zap, Brain, Lightbulb, Sun, Moon, Monitor, Trash2, Shield, Cloud, Server, RefreshCw, ChevronRight, ChevronDown, Wifi, WifiOff, Key, Eye, EyeOff } from 'lucide-react';
import { GradingStrategy, testConnection } from '@/services/geminiService';
import { toast } from './Toast';
import { useTheme } from '@/hooks/useTheme';
import { Button } from './ui';
import { clearAllImages } from '@/utils/imageDB';
import PrivacyPolicy from './PrivacyPolicy';
import MembershipCard from './MembershipCard';
import ActivationView from './ActivationView';
import { isProxyMode, setProxyMode } from '@/services/proxyService';
import { getAppConfig, saveAppConfig, PROVIDER_DEFAULTS, MODEL_SUGGESTIONS } from '@/services/config-service';
import { ModelProviderType } from '@/types';
import { useAppStore } from '@/stores/useAppStore';

// @ts-ignore - Vite 环境变量
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:3000';


interface SettingsViewProps {
  onOpenRubric: () => void;
  isRubricConfigured: boolean;
  currentStrategy: GradingStrategy;
  onStrategyChange: (s: GradingStrategy) => void;
  onEditRubric?: (questionKey: string, rubric: string, questionHint: string) => void;
  onRubricDeleted?: () => void;
  onOpenAdmin?: () => void;
}

// 通用折叠容器组件
const CollapsibleSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  rightElement?: React.ReactNode;
}> = ({ title, icon, children, defaultOpen = true, rightElement }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all duration-300">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {rightElement}
          <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 内容区域，使用 height 动画或简单的条件渲染 */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenRubric,
  isRubricConfigured,
  currentStrategy,
  onStrategyChange,
  onOpenAdmin,
}) => {
  // 隐私政策弹窗
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  // 激活弹窗
  const [isActivationOpen, setIsActivationOpen] = useState(false);

  // API 配置状态（前端直连模式）
  const [apiConfig, setApiConfig] = useState(() => getAppConfig());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  // API 连接测试状态
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiTestMessage, setApiTestMessage] = useState('');
  // 策略测试状态
  const [strategyTestStatus, setStrategyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [strategyTestMessage, setStrategyTestMessage] = useState('');

  // 测试 API 连接
  const testApiConnection = useCallback(async () => {
    if (!apiConfig.apiKey) {
      toast.error('请先输入 API Key');
      return;
    }
    setApiTestStatus('testing');
    setApiTestMessage('');
    try {
      if (apiConfig.provider === 'google') {
        // Gemini API 测试
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiConfig.apiKey}`,
          { method: 'GET', signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          setApiTestStatus('success');
          setApiTestMessage('Gemini API 连接成功');
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } else if (apiConfig.provider === 'zhipu') {
        // 智谱 API 测试 - 简单验证 Key 格式
        if (apiConfig.apiKey.includes('.')) {
          setApiTestStatus('success');
          setApiTestMessage('智谱 API Key 格式正确');
        } else {
          throw new Error('Key 格式不正确，应为 {id}.{secret}');
        }
      } else if (apiConfig.provider === 'alibaba') {
        // 阿里云 API 测试 - 验证 Key 格式并调用 API
        if (!apiConfig.apiKey.startsWith('sk-')) {
          throw new Error('Key 格式不正确，应以 sk- 开头');
        }
        // 使用简单的请求测试连接
        const res = await fetch(apiConfig.endpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.modelName || 'qwen-vl-max',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (res.ok) {
          setApiTestStatus('success');
          setApiTestMessage('阿里云百炼 API 连接成功');
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${res.status}`);
        }
      } else {
        // OpenAI 兼容 API 测试
        // 从 chat/completions 端点提取基础 URL 并调用 /models 端点测试
        let testEndpoint = apiConfig.endpoint || 'https://api.openai.com/v1/chat/completions';
        // 将 /chat/completions 替换为 /models
        testEndpoint = testEndpoint.replace('/chat/completions', '/models');
        const res = await fetch(testEndpoint, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` },
          signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          setApiTestStatus('success');
          setApiTestMessage('API 连接成功');
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      }
    } catch (e: any) {
      setApiTestStatus('error');
      setApiTestMessage(e.message || '连接失败');
    }
  }, [apiConfig]);

  // 测试当前策略
  const testStrategy = useCallback(async () => {
    if (!apiConfig.apiKey) {
      toast.error('请先配置 API Key');
      return;
    }
    setStrategyTestStatus('testing');
    setStrategyTestMessage('');
    try {
      // 使用 testConnection 测试当前策略对应的模型
      const success = await testConnection(apiConfig);
      if (success) {
        setStrategyTestStatus('success');
        setStrategyTestMessage(`当前策略 (${currentStrategy}) 连接成功`);
      } else {
        throw new Error('连接失败');
      }
    } catch (e: any) {
      setStrategyTestStatus('error');
      setStrategyTestMessage(e.message || '策略测试失败');
    }
  }, [apiConfig, currentStrategy]);

  // 主题状态
  const { theme, setTheme, isDark } = useTheme();



  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50 dark:bg-gray-900 animate-in fade-in duration-300">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

        {/* === 0. Membership Card === */}
        <MembershipCard
          onActivate={() => setIsActivationOpen(true)}
          onPurchase={() => {
            window.open(`${API_BASE_URL}/pay`, '_blank');
          }}
        />

        {/* === EXPERIMENTAL: Switch to V2 === */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-xl shadow-lg mb-4">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-300" />
                体验新版界面 (V14 Beta)
              </h3>
              <p className="text-xs text-indigo-100 mt-1">全新设计，更流畅的阅卷体验</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={() => useAppStore.getState().setShowV2(true)}
            >
              立即切换
            </Button>
          </div>
        </div>

        {/* === 1. API 配置 === */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center mb-3">
            <Server className="w-4 h-4 mr-2 text-blue-600" />
            API 配置
          </h3>

          <div className="space-y-3">
            {/* 服务商选择 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                AI 服务商
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['google', 'openai', 'zhipu', 'alibaba'] as const).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => {
                      const defaults = PROVIDER_DEFAULTS[provider];
                      setApiConfig(prev => ({
                        ...prev,
                        provider,
                        endpoint: defaults.endpoint,
                        modelName: defaults.model
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${apiConfig.provider === provider
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    {provider === 'google' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'zhipu' ? '智谱' : '阿里云'}
                  </button>
                ))}
              </div>
            </div>

            {/* API Endpoint 输入 */}
            {apiConfig.provider !== 'google' && (
              <div>
                <label htmlFor="api-endpoint" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  API Endpoint
                </label>
                <input
                  id="api-endpoint"
                  type="text"
                  value={apiConfig.endpoint}
                  onChange={(e) => setApiConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder={PROVIDER_DEFAULTS[apiConfig.provider].endpoint}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {apiConfig.provider === 'openai' && '支持 OpenAI 兼容格式的第三方中转地址'}
                  {apiConfig.provider === 'zhipu' && '默认使用智谱官方地址,可自定义'}
                  {apiConfig.provider === 'alibaba' && '默认使用阿里云百炼官方地址'}
                </p>
              </div>
            )}

            {/* API Key 输入 */}
            <div>
              <label htmlFor="api-key" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiConfig.apiKey}
                  onChange={(e) => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="输入你的 API Key"
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testApiConnection}
                loading={apiTestStatus === 'testing'}
                disabled={!apiConfig.apiKey || apiTestStatus === 'testing'}
                className="flex-1"
              >
                测试连接
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsSavingConfig(true);
                  try {
                    saveAppConfig(apiConfig);
                    toast.success('API 配置已保存');
                  } catch (e) {
                    toast.error('保存失败');
                  } finally {
                    setIsSavingConfig(false);
                  }
                }}
                loading={isSavingConfig}
                disabled={!apiConfig.apiKey}
                className="flex-1"
              >
                保存配置
              </Button>
            </div>

            {/* 连接测试状态 */}
            {apiTestStatus === 'success' && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                {apiTestMessage}
              </p>
            )}
            {apiTestStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                连接失败: {apiTestMessage}
              </p>
            )}
            {apiTestStatus === 'idle' && apiConfig.apiKey && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                API Key 已配置,请测试连接
              </p>
            )}
          </div>
        </div>

        {/* === 2. 阅卷策略 (Collapsible, 默认折叠) === */}
        <CollapsibleSection
          title="阅卷策略"
          icon={<Cpu className="w-5 h-5 text-blue-600" />}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="flex items-start">
                <div className="mr-2 mt-0.5 text-blue-500"><Lightbulb className="w-4 h-4" /></div>
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  <p className="font-bold mb-0.5">策略说明</p>
                  根据题目难度选择合适的策略。策略决定使用哪个 AI 模型和推理深度。
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <StrategyOption
                title="快速模式"
                modelName="Gemini 2.5 Flash"
                desc="响应快速，智能识别。适合简单填空、选择题或大批量批改。"
                selected={currentStrategy === 'flash'}
                onClick={() => onStrategyChange('flash')}
                icon={Zap}
                badge="最快"
                badgeColor="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
              />

              <StrategyOption
                title="精准模式"
                modelName="Gemini 3 Flash"
                desc="高质量批改，细节把控更准。适合常规简答题、计算题。"
                selected={currentStrategy === 'pro'}
                onClick={() => onStrategyChange('pro')}
                icon={Brain}
                badge="推荐"
                badgeColor="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
              />

              <StrategyOption
                title="深度推理"
                modelName="Gemini 3 Pro"
                desc="最强分析能力，深度理解题意。适合复杂论述、开放题。"
                selected={currentStrategy === 'reasoning'}
                onClick={() => onStrategyChange('reasoning')}
                icon={Cpu}
              />
            </div>

            {/* 策略测试按钮 */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={testStrategy}
                loading={strategyTestStatus === 'testing'}
                disabled={!apiConfig.apiKey || strategyTestStatus === 'testing'}
                className="w-full"
              >
                测试当前策略
              </Button>
              {strategyTestStatus === 'success' && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Wifi className="w-3 h-3" />
                  {strategyTestMessage}
                </p>
              )}
              {strategyTestStatus === 'error' && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  {strategyTestMessage}
                </p>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* === 3. 评分标准 === */}
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border shadow-sm transition-all ${isRubricConfigured
          ? 'border-green-200 dark:border-green-800'
          : 'border-gray-200 dark:border-gray-700'
          }`}>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center">
              <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
              评分标准
            </h3>
            {isRubricConfigured && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 text-[10px] rounded-full font-medium border border-green-200 dark:border-green-800">
                已配置
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {isRubricConfigured
              ? "系统已加载评分细则。如需调整，请点击下方按钮。"
              : "AI 需要先学习这道题的评分细则才能开始工作。"
            }
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenRubric}
            icon={<FileEdit className="w-3.5 h-3.5" />}
            className="w-full bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            配置评分细则
          </Button>
        </div>

        {/* === 5. 隐私政策 === */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => setIsPrivacyPolicyOpen(true)}
            className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 -m-4 p-4 rounded-xl transition-colors"
          >
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">隐私政策</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">了解数据如何处理</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        </div>

        {/* === 6. 管理后台 === */}
        {onOpenAdmin && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-xl shadow-lg">
            <button
              onClick={onOpenAdmin}
              className="w-full flex items-center justify-between text-left hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center mr-3">
                  <span className="material-symbols-outlined text-white text-[20px]">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">管理后台</h3>
                  <p className="text-xs text-white/80">查看激活码和使用统计</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80" />
            </button>
          </div>
        )}

      </div>

      {/* 底部操作栏 */}
      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end space-x-2">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
          onClick={async () => {
            try {
              localStorage.clear();
            } catch (e) {
              // ignore
            }
            try {
              await clearAllImages();
            } catch (e) {
              // ignore
            }
            try {
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.clear(() => window.location.reload());
                return;
              }
            } catch (e) {
              // ignore
            }
            window.location.reload();
          }}
        >
          清除缓存数据
        </Button>
      </div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicy
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />

      {/* Activation Modal */}
      <ActivationView
        isOpen={isActivationOpen}
        onClose={() => setIsActivationOpen(false)}
        onActivated={(info) => {
          toast.success(`激活成功！${info.type === 'permanent' ? '永久会员' : '会员已激活'}`);
          setIsActivationOpen(false);
        }}
        onPurchase={() => {
          window.open(`${API_BASE_URL}/pay`, '_blank');
        }}
        onFreeTrial={() => {
          setIsActivationOpen(false);
          toast.info('免费试用：共有 300 次免费额度');
        }}
      />
    </div>
  );
};


interface StrategyOptionProps {
  title: string;
  modelName: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const StrategyOption = ({ title, modelName, desc, selected, onClick, badge, badgeColor, icon: Icon }: StrategyOptionProps) => (
  <div
    onClick={onClick}
    className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${selected
      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
  >
    <div className={`mr-3 mt-0.5 shrink-0 ${selected ? 'text-blue-600' : 'text-gray-400'}`}>
      {selected ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {Icon && <Icon className={`w-3.5 h-3.5 mr-1.5 ${selected ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`} />}
          <span className={`text-sm font-bold ${selected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>{title}</span>
        </div>
        {badge && <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded font-medium ${badgeColor || 'bg-gray-100 text-gray-600'}`}>{badge}</span>}
      </div>
      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{modelName}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-1">{desc}</p>
    </div>
  </div>
);

export default SettingsView;