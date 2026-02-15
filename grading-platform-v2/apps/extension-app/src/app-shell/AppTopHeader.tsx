import type { ReactNode } from "react";

type AppTopHeaderProps = {
  title: string;
  onOpenSettings: () => void;
  gearIcon: ReactNode;
};

export const AppTopHeader = ({ title, onOpenSettings, gearIcon }: AppTopHeaderProps) => {
  return (
    <header className="classic-simple-header">
      <h1>{title}</h1>
      <div className="classic-header-actions">
        <span className="classic-trial-chip">试用版</span>
        <button
          type="button"
          className="classic-gear-btn"
          aria-label="打开设置"
          onClick={onOpenSettings}
        >
          {gearIcon}
        </button>
      </div>
    </header>
  );
};
