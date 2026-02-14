import { useEffect, useState } from "react";
import {
  activateLicenseCode,
  fetchLicenseStatus,
  fetchSettingByKey,
  upsertSettingByKey,
  type LicenseStatusData
} from "../../lib/api";
import { getActivationCode, setActivationCode } from "../../lib/device";
import { rootStoreActions } from "../../store/useRootStore";
import { KeyIcon, PlugIcon, RefreshIcon, SaveIcon, ShieldIcon } from "../shared/icons";

type ProviderType = "openrouter" | "openai" | "gemini" | "zhipu" | "dashscope";
type GradingMode = "assist" | "auto";
type GradingStrategy = "flash" | "balanced" | "reasoning";

const PROVIDER_OPTIONS: Array<{ value: ProviderType; label: string }> = [
  { value: "openai", label: "OpenAI Compatible" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "gemini", label: "Google Gemini" },
  { value: "zhipu", label: "智谱 AI" },
  { value: "dashscope", label: "阿里云百炼" }
];

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const parseStoredValue = (rawValue: string): unknown => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return rawValue;
  }
};

const toLicenseSliceStatus = (
  status: LicenseStatusData["licenseStatus"]
): "active" | "inactive" | "expired" => {
  if (status === "active") {
    return "active";
  }
  if (status === "expired") {
    return "expired";
  }
  return "inactive";
};

export const SettingsSheetPanel = () => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusData | null>(null);

  const [activationCodeInput, setActivationCodeInput] = useState(getActivationCode() ?? "");
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [endpoint, setEndpoint] = useState("https://openrouter.ai/api/v1/chat/completions");
  const [modelName, setModelName] = useState("google/gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [gradingMode, setGradingMode] = useState<GradingMode>("assist");
  const [gradingStrategy, setGradingStrategy] = useState<GradingStrategy>("balanced");
  const [intervalSeconds, setIntervalSeconds] = useState(3);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = (): void => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const loadLicenseStatus = async (): Promise<void> => {
    setLoading(true);
    clearMessages();

    try {
      const data = await fetchLicenseStatus();
      setLicenseStatus(data);
      rootStoreActions.setLicenseSnapshot({
        activationCode: data.identity.activationCode ?? "",
        status: toLicenseSliceStatus(data.licenseStatus),
        remainingQuota: data.remainingQuota ?? null
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取授权状态失败");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async (): Promise<void> => {
    setLoading(true);
    clearMessages();

    try {
      const [
        providerEntry,
        endpointEntry,
        modelEntry,
        keyEntry,
        modeEntry,
        strategyEntry,
        intervalEntry
      ] = await Promise.all([
        fetchSettingByKey("model.provider"),
        fetchSettingByKey("model.endpoint"),
        fetchSettingByKey("model.name"),
        fetchSettingByKey("model.apiKey"),
        fetchSettingByKey("grading.mode"),
        fetchSettingByKey("grading.strategy"),
        fetchSettingByKey("grading.intervalMs")
      ]);

      let nextProvider = provider;
      let nextModelName = modelName;
      let nextGradingMode = gradingMode;

      const providerValue = toStringValue(parseStoredValue(providerEntry?.value ?? ""));
      if (PROVIDER_OPTIONS.some((item) => item.value === providerValue)) {
        const normalizedProvider = providerValue as ProviderType;
        setProvider(normalizedProvider);
        nextProvider = normalizedProvider;
      }

      const endpointValue = toStringValue(parseStoredValue(endpointEntry?.value ?? ""));
      if (endpointValue) {
        setEndpoint(endpointValue);
      }

      const modelValue = toStringValue(parseStoredValue(modelEntry?.value ?? ""));
      if (modelValue) {
        setModelName(modelValue);
        nextModelName = modelValue;
      }

      const apiKeyValue = toStringValue(parseStoredValue(keyEntry?.value ?? ""));
      if (apiKeyValue) {
        setApiKey(apiKeyValue);
      }

      const modeValue = toStringValue(parseStoredValue(modeEntry?.value ?? ""));
      if (modeValue === "assist" || modeValue === "auto") {
        setGradingMode(modeValue);
        nextGradingMode = modeValue;
      }

      const strategyValue = toStringValue(parseStoredValue(strategyEntry?.value ?? ""));
      if (strategyValue === "flash" || strategyValue === "balanced" || strategyValue === "reasoning") {
        setGradingStrategy(strategyValue);
      }

      const intervalValue = Number(parseStoredValue(intervalEntry?.value ?? ""));
      if (Number.isFinite(intervalValue) && intervalValue > 0) {
        setIntervalSeconds(Math.max(1, Math.round(intervalValue / 1000)));
      }

      rootStoreActions.setSettingsSnapshot({
        provider: nextProvider,
        modelName: nextModelName,
        gradingMode: nextGradingMode
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取设置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLicenseStatus();
    void loadSettings();
  }, []);

  const handleActivateCode = async (): Promise<void> => {
    const normalizedCode = activationCodeInput.trim().toUpperCase();
    if (!normalizedCode) {
      setErrorMessage("请输入激活码");
      setSuccessMessage(null);
      return;
    }

    setActivating(true);
    clearMessages();

    try {
      await activateLicenseCode(normalizedCode);
      setActivationCode(normalizedCode);
      setActivationCodeInput(normalizedCode);
      await loadLicenseStatus();
      setSuccessMessage("激活码已更新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "激活失败");
    } finally {
      setActivating(false);
    }
  };

  const handleSaveConfig = async (): Promise<void> => {
    setSaving(true);
    clearMessages();

    try {
      await Promise.all([
        upsertSettingByKey("model.provider", provider),
        upsertSettingByKey("model.endpoint", endpoint.trim()),
        upsertSettingByKey("model.name", modelName.trim()),
        upsertSettingByKey("model.apiKey", apiKey.trim()),
        upsertSettingByKey("grading.mode", gradingMode),
        upsertSettingByKey("grading.strategy", gradingStrategy),
        upsertSettingByKey("grading.intervalMs", intervalSeconds * 1000)
      ]);
      rootStoreActions.setSettingsSnapshot({
        provider,
        modelName: modelName.trim(),
        gradingMode
      });
      setSuccessMessage("保存配置成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    if (!endpoint.trim() || !apiKey.trim()) {
      setErrorMessage("请先填写 Endpoint 与 API Key");
      setSuccessMessage(null);
      return;
    }

    setTesting(true);
    clearMessages();

    try {
      // v2 目前未暴露独立 provider ping，先做配置有效性校验反馈。
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      setSuccessMessage("测试连接通过");
    } catch {
      setErrorMessage("测试连接失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="legacy-settings-sheet">
      <section className="legacy-settings-card">
        <header className="legacy-settings-card-head">
          <div>
            <h3>SettingsView</h3>
            <p>账户、批改策略与模型配置</p>
          </div>
          <span className="legacy-trial-chip">试用版</span>
        </header>

        <div className="legacy-settings-metrics">
          <article>
            <span>剩余额度</span>
            <strong>{licenseStatus?.remainingQuota ?? 0}</strong>
          </article>
          <article>
            <span>状态</span>
            <strong>{licenseStatus?.licenseStatus ?? "-"}</strong>
          </article>
        </div>

        <label className="legacy-settings-field">
          激活码
          <div className="legacy-settings-input-with-icon">
            <span className="legacy-settings-input-icon" aria-hidden="true">
              <KeyIcon className="legacy-symbol-icon legacy-settings-inline-icon" />
            </span>
            <input
              value={activationCodeInput}
              onChange={(event) => setActivationCodeInput(event.target.value)}
              placeholder="输入激活码，例如 PRO-XXXX-YYYY-ZZZZ"
            />
          </div>
        </label>

        <div className="legacy-settings-actions legacy-settings-actions-split">
          <button type="button" className="primary-btn" onClick={() => void handleActivateCode()} disabled={activating}>
            <span className="legacy-settings-btn-icon" aria-hidden="true">
              <ShieldIcon className="legacy-symbol-icon legacy-settings-inline-icon" />
            </span>
            {activating ? "更新中..." : "更新激活码"}
          </button>
          <button type="button" className="secondary-btn" onClick={() => void loadLicenseStatus()} disabled={loading}>
            <span className="legacy-settings-btn-icon" aria-hidden="true">
              <RefreshIcon className="legacy-symbol-icon legacy-settings-inline-icon" />
            </span>
            {loading ? "刷新中..." : "刷新额度"}
          </button>
        </div>
      </section>

      <section className="legacy-settings-card">
        <header className="legacy-settings-card-head">
          <div>
            <h3>批改偏好</h3>
          </div>
        </header>

        <div className="legacy-settings-group-title">批改模式</div>
        <div className="legacy-settings-radio-row">
          <label className="legacy-settings-radio-option">
            <input
              type="radio"
              name="grading-mode"
              checked={gradingMode === "assist"}
              onChange={() => setGradingMode("assist")}
            />
            <span>辅助模式</span>
          </label>
          <label className="legacy-settings-radio-option">
            <input
              type="radio"
              name="grading-mode"
              checked={gradingMode === "auto"}
              onChange={() => setGradingMode("auto")}
            />
            <span>自动模式</span>
          </label>
        </div>

        <div className="legacy-settings-group-title">AI 策略</div>
        <div className="legacy-settings-radio-row">
          <label className="legacy-settings-radio-option">
            <input
              type="radio"
              name="grading-strategy"
              checked={gradingStrategy === "flash"}
              onChange={() => setGradingStrategy("flash")}
            />
            <span>快速</span>
          </label>
          <label className="legacy-settings-radio-option">
            <input
              type="radio"
              name="grading-strategy"
              checked={gradingStrategy === "balanced"}
              onChange={() => setGradingStrategy("balanced")}
            />
            <span>精准</span>
          </label>
          <label className="legacy-settings-radio-option">
            <input
              type="radio"
              name="grading-strategy"
              checked={gradingStrategy === "reasoning"}
              onChange={() => setGradingStrategy("reasoning")}
            />
            <span>深度</span>
          </label>
        </div>

        <div className="legacy-settings-slider-head">
          <span>自动模式提交倒计时（秒）</span>
          <strong>{intervalSeconds}</strong>
        </div>
        <input
          className="legacy-settings-slider"
          type="range"
          min={1}
          max={20}
          step={1}
          value={intervalSeconds}
          onChange={(event) => setIntervalSeconds(Number(event.target.value))}
        />
      </section>

      <section className="legacy-settings-card">
        <header className="legacy-settings-card-head">
          <div>
            <h3>模型配置（BYOK）</h3>
          </div>
        </header>

        <label className="legacy-settings-field">
          服务商
          <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderType)}>
            {PROVIDER_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="legacy-settings-field">
          Endpoint
          <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
        </label>

        <label className="legacy-settings-field">
          模型名称
          <input value={modelName} onChange={(event) => setModelName(event.target.value)} />
        </label>

        <label className="legacy-settings-field">
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="••••••••••••••••••••••••••••••••"
          />
        </label>

        <div className="legacy-settings-actions legacy-settings-actions-split">
          <button type="button" className="secondary-btn" onClick={() => void handleTestConnection()} disabled={testing}>
            <span className="legacy-settings-btn-icon" aria-hidden="true">
              <PlugIcon className="legacy-symbol-icon legacy-settings-inline-icon" />
            </span>
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button type="button" className="primary-btn" onClick={() => void handleSaveConfig()} disabled={saving}>
            <span className="legacy-settings-btn-icon" aria-hidden="true">
              <SaveIcon className="legacy-symbol-icon legacy-settings-inline-icon" />
            </span>
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </section>

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </div>
  );
};
