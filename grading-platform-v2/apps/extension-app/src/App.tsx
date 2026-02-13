import { LicensePanel } from "./modules/license/LicensePanel";
import { SettingsPanel } from "./modules/settings/SettingsPanel";

const App = () => {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Extension App V2</h1>
        <p>阶段 B-1：保留原有风格，先完成 License + Settings 接入 /api/v2/*</p>
      </header>

      <div className="module-grid">
        <LicensePanel />
        <SettingsPanel />
      </div>
    </main>
  );
};

export default App;
