import * as React from "react";
import { cn } from "../../lib/utils";

export type GradingMode = "assist" | "auto";

export type GradingModeSelectorProps = {
  mode: GradingMode;
  onChange: (mode: GradingMode) => void;
  disabled?: boolean;
  className?: string;
};

const modeOptions: Array<{
  value: GradingMode;
  title: string;
  description: string;
}> = [
  {
    value: "assist",
    title: "辅助模式",
    description: "批改后人工确认回填，不自动提交"
  },
  {
    value: "auto",
    title: "自动模式",
    description: "连续批改并自动回填提交"
  }
];

export const GradingModeSelector = ({ mode, onChange, disabled = false, className }: GradingModeSelectorProps) => {
  return (
    <div className={cn("ag-grading-mode-selector", className)} role="radiogroup" aria-label="批改模式">
      {modeOptions.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cn("ag-grading-mode-option", active && "ag-grading-mode-option-active")}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        );
      })}
    </div>
  );
};
