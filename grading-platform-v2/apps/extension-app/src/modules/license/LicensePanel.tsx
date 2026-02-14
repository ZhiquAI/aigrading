import { useEffect, useMemo, useState } from "react";
import { activateLicenseCode, fetchLicenseStatus, type LicenseStatusData } from "../../lib/api";
import { copyText } from "../../lib/clipboard";
import { getActivationCode, getDeviceId, setActivationCode } from "../../lib/device";

const maskCode = (code: string | null): string => {
  if (!code) {
    return "未设置";
  }

  if (code.length < 8) {
    return code;
  }

  return `${code.slice(0, 4)}-****-****-${code.slice(-4)}`;
};

const TEST_LICENSE_CODES = [
  "TEST-1111-2222-3333",
  "BASIC-AAAA-BBBB-CCCC",
  "PRO-XXXX-YYYY-ZZZZ",
  "PERM-AAAA-BBBB-CCCC"
];

export const LicensePanel = () => {
  const [inputCode, setInputCode] = useState(getActivationCode() ?? "");
  const [status, setStatus] = useState<LicenseStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const deviceId = useMemo(() => getDeviceId(), []);

  const refreshStatus = async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const nextStatus = await fetchLicenseStatus();
      setStatus(nextStatus);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取授权状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const handleActivate = async (): Promise<void> => {
    const normalized = inputCode.trim().toUpperCase();
    if (!normalized) {
      setErrorMessage("请输入激活码");
      return;
    }

    setActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await activateLicenseCode(normalized);
      setActivationCode(normalized);
      setInputCode(normalized);
      setSuccessMessage(result.alreadyBound ? "设备已绑定，状态已刷新" : "激活成功");
      await refreshStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "激活失败");
    } finally {
      setActivating(false);
    }
  };

  const handleClearActivationCode = (): void => {
    setActivationCode(null);
    setInputCode("");
    setSuccessMessage("已清空本地激活码");
    setErrorMessage(null);
  };

  const handleCopyDeviceId = async (): Promise<void> => {
    try {
      await copyText(deviceId);
      setSuccessMessage("设备 ID 已复制");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "复制失败");
    }
  };

  const handleFillCode = (code: string): void => {
    setInputCode(code);
    setSuccessMessage(`已填充测试激活码：${code}`);
    setErrorMessage(null);
  };

  const handlePasteCode = async (): Promise<void> => {
    if (!navigator.clipboard?.readText) {
      setErrorMessage("当前环境不支持读取剪贴板");
      return;
    }

    try {
      const pasted = (await navigator.clipboard.readText()).trim();
      if (!pasted) {
        setErrorMessage("剪贴板为空");
        return;
      }

      setInputCode(pasted.toUpperCase());
      setSuccessMessage("已从剪贴板粘贴激活码");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "粘贴失败");
    }
  };

  return (
    <section className="card">
      <header className="card-header">
        <h2>License</h2>
        <button type="button" className="secondary-btn" onClick={() => void refreshStatus()} disabled={loading}>
          {loading ? "刷新中..." : "刷新状态"}
        </button>
      </header>

      <div className="info-grid">
        <div>
          <span className="label">设备 ID</span>
          <div className="inline-action-row">
            <code>{deviceId}</code>
            <button type="button" className="secondary-btn mini-btn" onClick={() => void handleCopyDeviceId()}>
              复制
            </button>
          </div>
        </div>
        <div>
          <span className="label">本地激活码</span>
          <code>{maskCode(getActivationCode())}</code>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="activation-code">激活码</label>
        <input
          id="activation-code"
          type="text"
          value={inputCode}
          placeholder="TEST-1111-2222-3333"
          onChange={(event) => setInputCode(event.target.value)}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void handlePasteCode()} disabled={activating}>
          从剪贴板粘贴
        </button>
        {TEST_LICENSE_CODES.map((code) => (
          <button
            key={code}
            type="button"
            className="secondary-btn mini-btn"
            onClick={() => handleFillCode(code)}
            disabled={activating}
          >
            {code.slice(0, 4)}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="primary-btn" onClick={() => void handleActivate()} disabled={activating}>
          {activating ? "激活中..." : "激活并写入本地"}
        </button>
        <button type="button" className="danger-btn" onClick={handleClearActivationCode} disabled={activating}>
          清空本地激活码
        </button>
      </div>

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <div className="status-box">
        <h3>v2 状态返回</h3>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </div>
    </section>
  );
};
