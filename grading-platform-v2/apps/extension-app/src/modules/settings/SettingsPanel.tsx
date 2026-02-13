import { useState } from "react";
import { deleteSettingByKey, fetchSettingByKey, upsertSettingByKey } from "../../lib/api";

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        <button type="button" className="secondary-btn" onClick={() => void handleLoad()} disabled={loading}>
          读取
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
    </section>
  );
};
