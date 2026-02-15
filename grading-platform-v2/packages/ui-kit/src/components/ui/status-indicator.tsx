import * as React from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type StatusType = "success" | "error" | "warning" | "loading" | "idle";

export type StatusIndicatorProps = {
  status: StatusType;
  label: string;
  onClick?: () => void;
  clickable?: boolean;
  className?: string;
};

const statusClassNameMap: Record<StatusType, string> = {
  success: "ag-status-success",
  error: "ag-status-error",
  warning: "ag-status-warning",
  loading: "ag-status-loading",
  idle: "ag-status-idle"
};

const statusIconMap: Record<StatusType, React.ReactNode> = {
  success: <Check className="ag-status-icon" aria-hidden="true" />,
  error: <X className="ag-status-icon" aria-hidden="true" />,
  warning: <AlertTriangle className="ag-status-icon" aria-hidden="true" />,
  loading: <Loader2 className="ag-status-icon ag-status-icon-spin" aria-hidden="true" />,
  idle: null
};

export const StatusIndicator = ({
  status,
  label,
  onClick,
  clickable = false,
  className
}: StatusIndicatorProps): React.ReactElement => {
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "ag-status",
        statusClassNameMap[status],
        clickable ? "ag-status-clickable" : "",
        className
      )}
    >
      {statusIconMap[status]}
      <span>{label}</span>
    </Tag>
  );
};
