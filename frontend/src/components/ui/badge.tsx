import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "glass-badge glass-badge-orange text-secondary",
        secondary: "glass-badge glass-badge-muted text-foreground/60",
        destructive: "glass-badge glass-badge-danger",
        outline: "glass-badge text-foreground/60",
        success: "glass-badge glass-badge-success",
        warning: "glass-badge glass-badge-warning",
        info: "glass-badge glass-badge-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
