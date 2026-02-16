import { useEffect, useState } from "react";
import {
  activateLicenseCode,
  fetchLicenseStatus,
  fetchSettingByKey,
  testModelConnection,
  upsertSettingByKey,
  type LicenseStatusData
} from "../../lib/api";
import { getActivationCode, setActivationCode } from "../../lib/device";
import { rootStoreActions } from "../../store/useRootStore";
import { KeyIcon, PlugIcon, RefreshIcon, SaveIcon, ShieldIcon } from "../shared/icons";

type ProviderType = "openrouter" | "openai" | "gemini" | "zhipu" | "dashscope";

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

const resolveProviderTraceMessage = (trace: {
  mode?: string;
  reason?: string;
  attempts?: Array<{ provider?: string; message?: string }>;
}): string => {
  const firstAttempt = trace.attempts?.[0];
  const provider = firstAttempt?.provider ? `[${firstAttempt.provider}] ` : "";
  const message = firstAttempt?.message?.trim();

  if (message) {
    return `${provider}${message}`;
  }

  return trace.reason ?? "AI 连接失败，请检查 Endpoint、模型名称与 API Key。";
};

export const SettingsSheetPanel = () => {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusData | null>(null);

  const [activationCodeInput, setActivationCodeInput] = useState(getActivationCode() ?? "");
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [endpoint, setEndpoint] = useState("https://openrouter.ai/api/v1/chat/completions");
  const [modelName, setModelName] = useState("google/gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");

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
        keyEntry
      ] = await Promise.all([
        fetchSettingByKey("model.provider"),
        fetchSettingByKey("model.endpoint"),
        fetchSettingByKey("model.name"),
        fetchSettingByKey("model.apiKey")
      ]);

      let nextProvider = provider;
      let nextModelName = modelName;

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

      rootStoreActions.setSettingsSnapshot({
        provider: nextProvider,
        modelName: nextModelName
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
        upsertSettingByKey("model.apiKey", apiKey.trim())
      ]);
      rootStoreActions.setSettingsSnapshot({
        provider,
        modelName: modelName.trim()
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
      const probe = await testModelConnection({
        provider,
        endpoint: endpoint.trim(),
        modelName: modelName.trim(),
        apiKey: apiKey.trim()
      });

      if (probe.connected) {
        setSuccessMessage(`测试连接通过（${probe.provider}）`);
      } else {
        setErrorMessage(resolveProviderTraceMessage(probe));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "测试连接失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-sheet classic-settings-sheet">
      <section className="settings-card classic-settings-card">
        <header className="settings-card-head classic-settings-card-head">
          <div>
            <h3>SettingsView</h3>
            <p>账户与模型配置</p>
          </div>
          <span className="app-trial-chip classic-trial-chip">试用版</span>
        </header>

        <div className="settings-metrics classic-settings-metrics">
          <article>
            <span>剩余额度</span>
            <strong>{licenseStatus?.remainingQuota ?? 0}</strong>
          </article>
          <article>
            <span>状态</span>
            <strong>{licenseStatus?.licenseStatus ?? "-"}</strong>
          </article>
        </div>

        <label className="settings-field classic-settings-field">
          激活码
          <div className="settings-input-with-icon classic-settings-input-with-icon">
            <span className="settings-input-icon classic-settings-input-icon" aria-hidden="true">
              <KeyIcon className="classic-symbol-icon settings-inline-icon classic-settings-inline-icon" />
            </span>
            <input
              value={activationCodeInput}
              onChange={(event) => setActivationCodeInput(event.target.value)}
              placeholder="输入激活码，例如 PRO-XXXX-YYYY-ZZZZ"
            />
          </div>
        </label>

        <div className="settings-actions settings-actions-split classic-settings-actions classic-settings-actions-split">
          <button type="button" className="primary-btn" onClick={() => void handleActivateCode()} disabled={activating}>
            <span className="settings-btn-icon classic-settings-btn-icon" aria-hidden="true">
              <ShieldIcon className="classic-symbol-icon settings-inline-icon classic-settings-inline-icon" />
            </span>
            {activating ? "更新中..." : "更新激活码"}
          </button>
          <button type="button" className="secondary-btn" onClick={() => void loadLicenseStatus()} disabled={loading}>
            <span className="settings-btn-icon classic-settings-btn-icon" aria-hidden="true">
              <RefreshIcon className="classic-symbol-icon settings-inline-icon classic-settings-inline-icon" />
            </span>
            {loading ? "刷新中..." : "刷新额度"}
          </button>
        </div>
      </section>

      <section className="settings-card classic-settings-card">
        <header className="settings-card-head classic-settings-card-head">
          <div>
            <h3>模型配置（BYOK）</h3>
          </div>
        </header>

        <label className="settings-field classic-settings-field">
          服务商
          <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderType)}>
            {PROVIDER_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="settings-field classic-settings-field">
          Endpoint
          <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
        </label>

        <label className="settings-field classic-settings-field">
          模型名称
          <input value={modelName} onChange={(event) => setModelName(event.target.value)} />
        </label>

        <label className="settings-field classic-settings-field">
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="••••••••••••••••••••••••••••••••"
          />
        </label>

        <div className="settings-actions settings-actions-split classic-settings-actions classic-settings-actions-split">
          <button type="button" className="secondary-btn" onClick={() => void handleTestConnection()} disabled={testing}>
            <span className="settings-btn-icon classic-settings-btn-icon" aria-hidden="true">
              <PlugIcon className="classic-symbol-icon settings-inline-icon classic-settings-inline-icon" />
            </span>
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button type="button" className="primary-btn" onClick={() => void handleSaveConfig()} disabled={saving}>
            <span className="settings-btn-icon classic-settings-btn-icon" aria-hidden="true">
              <SaveIcon className="classic-symbol-icon settings-inline-icon classic-settings-inline-icon" />
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
