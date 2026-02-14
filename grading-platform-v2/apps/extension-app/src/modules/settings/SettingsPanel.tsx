import { useState } from "react";
import { deleteSettingByKey, fetchSettingByKey, fetchSettingsList, upsertSettingByKey } from "../../lib/api";

const parseValue = (rawValue: string): unknown => {
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

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const SettingsPanel = () => {
  const [key, setKey] = useState("model.provider");
  const [value, setValue] = useState("openrouter");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [settingsList, setSettingsList] = useState<Array<{ key: string; value: string; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const applyPreset = (presetKey: string, presetValue: unknown, presetLabel: string): void => {
    setKey(presetKey);
    setValue(stringifyValue(presetValue));
    setErrorMessage(null);
    setSuccessMessage(`已填充预设：${presetLabel}`);
  };

  const handleValidateJson = (): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSuccessMessage("当前值为空，视为合法");
      setErrorMessage(null);
      return;
    }

    try {
      JSON.parse(trimmed);
      setSuccessMessage("JSON 校验通过");
      setErrorMessage(null);
    } catch {
      setErrorMessage("当前值不是合法 JSON");
      setSuccessMessage(null);
    }
  };

  const handleFormatJson = (): void => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSuccessMessage("当前值为空，无需格式化");
      setErrorMessage(null);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      setValue(JSON.stringify(parsed, null, 2));
      setSuccessMessage("JSON 已格式化");
      setErrorMessage(null);
    } catch {
      setErrorMessage("当前值不是合法 JSON，无法格式化");
      setSuccessMessage(null);
    }
  };

  const handleLoad = async (): Promise<void> => {
    if (!key.trim()) {
      setErrorMessage("请先输入 key");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const setting = await fetchSettingByKey(key.trim());
      if (!setting) {
        setValue("");
        setUpdatedAt(null);
        setSuccessMessage("设置不存在，已清空编辑区");
        return;
      }

      setValue(stringifyValue(setting.value));
      setUpdatedAt(setting.updatedAt);
      setSuccessMessage("加载成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!key.trim()) {
      setErrorMessage("请先输入 key");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const saved = await upsertSettingByKey(key.trim(), parseValue(value));
      setValue(saved.value);
      setUpdatedAt(saved.updatedAt);
      setSuccessMessage("保存成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!key.trim()) {
      setErrorMessage("请先输入 key");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteSettingByKey(key.trim());
      setValue("");
      setUpdatedAt(null);
      setSuccessMessage("删除成功");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAll = async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const items = await fetchSettingsList();
      setSettingsList(items);
      setSuccessMessage(`已加载 ${items.length} 条设置`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取设置列表失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <header className="card-header">
        <h2>Settings</h2>
        <span className="hint">接口: /api/v2/settings</span>
      </header>

      <div className="field-group">
        <label htmlFor="setting-key">Key</label>
        <input
          id="setting-key"
          type="text"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="model.provider"
        />
      </div>

      <div className="field-group">
        <label htmlFor="setting-value">Value (支持 JSON)</label>
        <textarea
          id="setting-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={6}
          placeholder='例如: "openrouter" 或 {"vendor":"openrouter"}'
        />
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => applyPreset("model.provider", "openrouter", "Provider")}
          disabled={loading}
        >
          预设: Provider
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => applyPreset("grading.mode", "balanced", "Grading Mode")}
          disabled={loading}
        >
          预设: Grading Mode
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => applyPreset("ui.language", "zh-CN", "Language")}
          disabled={loading}
        >
          预设: Language
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => applyPreset("provider.priority", ["openrouter", "gemini", "glm"], "Provider Priority")}
          disabled={loading}
        >
          预设: Provider Priority
        </button>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={handleValidateJson} disabled={loading}>
          校验 JSON
        </button>
        <button type="button" className="secondary-btn" onClick={handleFormatJson} disabled={loading}>
          格式化 JSON
        </button>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void handleLoad()} disabled={loading}>
          读取
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleLoadAll()} disabled={loading}>
          读取全部
        </button>
        <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={loading}>
          保存
        </button>
        <button type="button" className="danger-btn" onClick={() => void handleDelete()} disabled={loading}>
          删除
        </button>
      </div>

      {updatedAt ? <p className="hint">最近更新时间：{updatedAt}</p> : null}
      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {settingsList.length > 0 ? (
        <div className="status-box">
          <h3>设置列表</h3>
          <pre>{JSON.stringify(settingsList, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
};
