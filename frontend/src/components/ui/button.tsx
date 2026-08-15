import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "glass-btn text-secondary border-secondary/20 hover:border-secondary/35",
        destructive:
          "glass-btn text-destructive border-destructive/20 hover:border-destructive/35",
        outline:
          "glass-btn text-foreground/70 hover:border-foreground/25",
        secondary:
          "glass-btn text-foreground/70 hover:border-foreground/25",
        ghost:
          "glass-btn text-foreground/70 hover:border-foreground/20",
        link:
          "text-secondary underline-offset-4 hover:underline",
        glass:
          "glass-btn text-foreground/70 hover:border-foreground/25",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-9 rounded-xl px-4 text-xs",
        lg:      "h-11 rounded-2xl px-7",
        icon:    "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
