import * as React from "react";
import { cn } from "../../lib/utils";

export type EmptyFeature = {
  icon: React.ReactNode;
  label: string;
};

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  features?: EmptyFeature[];
};

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, features, ...props }, ref) => (
    <div ref={ref} className={cn("ag-empty-state", className)} {...props}>
      {icon ? (
        <div className="ag-empty-state-icon-wrap">
          <div className="ag-empty-state-icon">{icon}</div>
        </div>
      ) : null}

      <h2 className="ag-empty-state-title">{title}</h2>

      {description ? <p className="ag-empty-state-description">{description}</p> : null}

      {features?.length ? (
        <div className="ag-empty-state-features">
          {features.map((feature, index) => (
            <div key={`${feature.label}-${index}`} className="ag-empty-state-feature">
              <div className="ag-empty-state-feature-icon">{feature.icon}</div>
              <span className="ag-empty-state-feature-label">{feature.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {action ? <div className="ag-empty-state-action">{action}</div> : null}
    </div>
  )
);

EmptyState.displayName = "EmptyState";
