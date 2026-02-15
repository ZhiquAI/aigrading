import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("ag-badge", {
  variants: {
    variant: {
      blue: "ag-badge-blue",
      green: "ag-badge-green",
      orange: "ag-badge-orange",
      red: "ag-badge-red",
      purple: "ag-badge-purple",
      gray: "ag-badge-gray",
      success: "ag-badge-success",
      warning: "ag-badge-warning"
    },
    size: {
      sm: "ag-badge-sm",
      md: "ag-badge-md"
    }
  },
  defaultVariants: {
    variant: "blue",
    size: "md"
  }
});

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    icon?: React.ReactNode;
  };

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon ? <span className="ag-badge-icon">{icon}</span> : null}
      {children}
    </span>
  )
);

Badge.displayName = "Badge";

export { badgeVariants };
