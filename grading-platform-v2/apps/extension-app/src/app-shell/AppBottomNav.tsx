import type { ReactNode } from "react";
import type { ModuleView } from "../store/useRootStore";

type NavItem = {
  key: ModuleView;
  label: string;
  icon: ReactNode;
  className: string;
  active: boolean;
  onClick: () => void;
};

type AppBottomNavProps = {
  activeView: ModuleView;
  items: NavItem[];
};

export const AppBottomNav = ({ activeView, items }: AppBottomNavProps) => {
  return (
    <footer className={`classic-nav classic-nav-${activeView}`}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`classic-nav-item ${item.className} ${item.active ? "classic-nav-item-active" : ""}`}
          onClick={item.onClick}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </footer>
  );
};
