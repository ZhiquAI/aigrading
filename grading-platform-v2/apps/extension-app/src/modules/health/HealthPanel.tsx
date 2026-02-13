import { useEffect, useState } from "react";
import { fetchHealthStatus, type HealthStatusDTO } from "../../lib/api";

export const HealthPanel = () => {
  const [status, setStatus] = useState<HealthStatusDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHealth = async (): Promise<void> => {
    setBusy(true);
    setErrorMessage(null);

    try {
      const result = await fetchHealthStatus();
      setStatus(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "健康检查失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadHealth();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefresh]);

  return (
    <section className="card">
      <header className="card-header">
        <h2>Health</h2>
        <div className="btn-row">
          <button type="button" className="secondary-btn" onClick={() => void loadHealth()} disabled={busy}>
            {busy ? "检查中..." : "刷新"}
          </button>
          <button
            type="button"
            className={autoRefresh ? "primary-btn" : "secondary-btn"}
            onClick={() => setAutoRefresh((current) => !current)}
            disabled={busy}
          >
            {autoRefresh ? "自动刷新: 开" : "自动刷新: 关"}
          </button>
        </div>
      </header>

      <p className="hint">接口: /api/health</p>

      {status ? (
        <div className="status-box">
          <h3>服务状态</h3>
          <pre>{JSON.stringify(status, null, 2)}</pre>
        </div>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
