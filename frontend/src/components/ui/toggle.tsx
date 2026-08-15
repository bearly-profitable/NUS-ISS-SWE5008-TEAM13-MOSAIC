import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded-md text-footnote font-semibold",
    "transition-[background-color,color,box-shadow,transform] duration-150 ease-apple",
    "active:scale-[0.97] active:[transition-duration:60ms]",
    "text-label-2 hover:bg-muted hover:text-label-1",
    "data-[state=on]:bg-card data-[state=on]:text-label-1 data-[state=on]:shadow-1",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "glass-btn",
      },
      size: {
        default: "h-7 px-2.5",
        sm: "h-6 px-2",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
