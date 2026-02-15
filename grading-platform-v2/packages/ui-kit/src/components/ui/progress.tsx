import * as React from "react";
import { cn } from "../../lib/utils";

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  max?: number;
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const safeMax = max <= 0 ? 100 : max;
    const percentage = Math.max(0, Math.min((value / safeMax) * 100, 100));

    return (
      <div
        ref={ref}
        className={cn("ag-progress", className)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        {...props}
      >
        <div className="ag-progress-value" style={{ width: `${percentage}%` }} />
      </div>
    );
  }
);

Progress.displayName = "Progress";
