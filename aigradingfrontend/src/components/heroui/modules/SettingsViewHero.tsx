import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Slider,
} from '@heroui/react';
import { KeyRound, RotateCw, Save, Server, ShieldCheck, TestTubeDiagonal } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { getAppConfig, PROVIDER_DEFAULTS, saveAppConfig } from '@/services/config-service';
import { testConnection } from '@/services/geminiService';
import type { AppConfig, ModelProviderType } from '@/types';

const providerLabels: Record<ModelProviderType, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI Compatible',
  zhipu: '智谱 AI',
  alibaba: '阿里云百炼',
};

function firstSelectionKey(keys: unknown): string | null {
  if (!keys || keys === 'all') return null;
  if (keys instanceof Set) {
    const first = keys.values().next().value;
    return first ? String(first) : null;
  }
  return null;
}

const SettingsViewHero: React.FC = () => {
  const {
    quota,
    activationCode,
    gradingMode,
    setGradingMode,
    gradingStrategy,
    setGradingStrategy,
    autoGradingInterval,
    setAutoGradingInterval,
    setActivationCode,
    syncQuota,
  } = useAppStore();

  const [activationCodeDraft, setActivationCodeDraft] = useState(activationCode || '');
  const [apiConfig, setApiConfig] = useState<AppConfig>(() => getAppConfig());
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const intervalSeconds = useMemo(() => Math.round(autoGradingInterval / 1000), [autoGradingInterval]);

  const applyActivationCode = () => {
    const normalized = activationCodeDraft.trim();
    setActivationCode(normalized || null);
    toast.success(normalized ? '激活码已更新' : '激活码已清除');
  };

  const handleSyncQuota = async () => {
    await syncQuota();
    toast.success('额度已刷新');
  };

  const handleProviderChange = (keys: unknown) => {
    const value = firstSelectionKey(keys) as ModelProviderType | null;
    if (!value) return;

    const defaults = PROVIDER_DEFAULTS[value];
    setApiConfig((prev) => ({
      ...prev,
      provider: value,
      endpoint: defaults.endpoint,
      modelName: defaults.model,
    }));
  };

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    try {
      saveAppConfig(apiConfig);
      toast.success('模型配置已保存');
    } catch (error) {
      toast.error('配置保存失败');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const ok = await testConnection(apiConfig);
      if (ok) {
        toast.success('连接测试成功');
      } else {
        toast.error('连接测试失败，请检查配置');
      }
    } catch (error) {
      toast.error('连接测试异常');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-semibold">SettingsView</p>
            <p className="text-xs text-default-500">账户、批改策略与模型配置</p>
          </div>
          <Chip size="sm" color={quota.isPaid ? 'success' : 'warning'} variant="flat">
            {quota.isPaid ? '专业版' : '试用版'}
          </Chip>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <Card shadow="none" className="border border-default-200">
              <CardBody className="gap-1 p-3">
                <p className="text-xs text-default-500">剩余额度</p>
                <p className="text-lg font-semibold">{quota.remaining}</p>
              </CardBody>
            </Card>
            <Card shadow="none" className="border border-default-200">
              <CardBody className="gap-1 p-3">
                <p className="text-xs text-default-500">状态</p>
                <p className="text-lg font-semibold">{quota.status}</p>
              </CardBody>
            </Card>
          </div>

          <Input
            label="激活码"
            labelPlacement="outside"
            startContent={<KeyRound size={14} className="text-default-500" />}
            value={activationCodeDraft}
            onValueChange={setActivationCodeDraft}
            placeholder="输入激活码，例如 PRO-XXXX-YYYY-ZZZZ"
          />

          <div className="flex flex-wrap gap-2">
            <Button color="primary" startContent={<ShieldCheck size={14} />} onPress={applyActivationCode}>
              更新激活码
            </Button>
            <Button variant="flat" startContent={<RotateCw size={14} />} onPress={() => void handleSyncQuota()}>
              刷新额度
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <p className="text-sm font-semibold">批改偏好</p>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <RadioGroup
            label="批改模式"
            orientation="horizontal"
            value={gradingMode}
            onValueChange={(value) => setGradingMode(value as 'assist' | 'auto')}
          >
            <Radio value="assist">辅助模式</Radio>
            <Radio value="auto">自动模式</Radio>
          </RadioGroup>

          <RadioGroup
            label="AI 策略"
            orientation="horizontal"
            value={gradingStrategy}
            onValueChange={(value) => setGradingStrategy(value as 'flash' | 'pro' | 'reasoning')}
          >
            <Radio value="flash">快速</Radio>
            <Radio value="pro">精准</Radio>
            <Radio value="reasoning">深度</Radio>
          </RadioGroup>

          <Slider
            label="自动模式提交倒计时（秒）"
            minValue={1}
            maxValue={20}
            step={1}
            value={intervalSeconds}
            onChange={(value) => {
              if (typeof value === 'number') {
                setAutoGradingInterval(value * 1000);
              }
            }}
            className="max-w-full"
            showTooltip
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <p className="text-sm font-semibold">模型配置（BYOK）</p>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <Select
            label="服务商"
            labelPlacement="outside"
            selectedKeys={[apiConfig.provider]}
            onSelectionChange={handleProviderChange}
            startContent={<Server size={14} className="text-default-500" />}
          >
            {Object.entries(providerLabels).map(([key, label]) => (
              <SelectItem key={key}>{label}</SelectItem>
            ))}
          </Select>

          {apiConfig.provider !== 'google' ? (
            <Input
              label="Endpoint"
              labelPlacement="outside"
              value={apiConfig.endpoint}
              onValueChange={(value) => setApiConfig((prev) => ({ ...prev, endpoint: value }))}
            />
          ) : null}

          <Input
            label="模型名称"
            labelPlacement="outside"
            value={apiConfig.modelName}
            onValueChange={(value) => setApiConfig((prev) => ({ ...prev, modelName: value }))}
          />

          <Input
            label="API Key"
            labelPlacement="outside"
            type="password"
            value={apiConfig.apiKey}
            onValueChange={(value) => setApiConfig((prev) => ({ ...prev, apiKey: value }))}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="flat"
              startContent={<TestTubeDiagonal size={14} />}
              isLoading={isTesting}
              onPress={() => {
                void handleTestConnection();
              }}
            >
              测试连接
            </Button>
            <Button
              color="primary"
              startContent={<Save size={14} />}
              isLoading={isSavingConfig}
              onPress={handleSaveConfig}
            >
              保存配置
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsViewHero;
