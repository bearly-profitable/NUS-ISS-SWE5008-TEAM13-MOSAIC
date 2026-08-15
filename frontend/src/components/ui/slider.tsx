import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, onPointerDown, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    onPointerDown={(e) => {
      e.stopPropagation();
      onPointerDown?.(e);
    }}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full border border-separator bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    {(Array.isArray(props.value) ? props.value : (Array.isArray(props.defaultValue) ? props.defaultValue : [0])).map((_, i) => (
      <SliderPrimitive.Thumb key={i} className="block h-4 w-4 cursor-grab rounded-full border border-separator bg-white shadow-2 transition-transform duration-100 ease-apple hover:scale-110 active:scale-[1.18] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50" />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
