import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("ag-btn", {
  variants: {
    variant: {
      primary: "ag-btn-primary",
      secondary: "ag-btn-secondary",
      success: "ag-btn-success",
      danger: "ag-btn-danger",
      outline: "ag-btn-outline",
      ghost: "ag-btn-ghost",
      gradient: "ag-btn-gradient",
      unstyled: "ag-btn-unstyled"
    },
    size: {
      sm: "ag-btn-sm",
      md: "ag-btn-md",
      lg: "ag-btn-lg"
    },
    fullWidth: {
      true: "ag-btn-full",
      false: ""
    }
  },
  defaultVariants: {
    variant: "primary",
    fullWidth: false
  }
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const resolvedSize = variant === "unstyled" ? undefined : (size ?? "md");

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: resolvedSize, fullWidth }), loading ? "ag-btn-loading" : "", className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <span className="ag-btn-spinner" aria-hidden="true" /> : null}
        {!loading && icon ? <span className="ag-btn-icon">{icon}</span> : null}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { buttonVariants };
