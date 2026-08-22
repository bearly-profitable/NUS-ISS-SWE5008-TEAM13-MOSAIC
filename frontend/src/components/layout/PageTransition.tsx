import { useLayoutEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useChrome } from "@/contexts/ChromeContext";

/**
 * Steps travel right-to-left going forward and left-to-right going back, so
 * the transition itself says which way through the pipeline you just moved.
 *
 * `direction` is read from `custom` rather than the prop, because the page on
 * its way out was rendered before the route changed — only AnimatePresence's
 * own `custom` reaches an exiting child with the *new* direction.
 */
const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 42 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -42 }),
};

export function PageTransition({ direction, children }: { direction: number; children: ReactNode }) {
  // `mode="wait"` means this only runs once the previous page has finished
  // leaving, which is exactly when resetting the scroller is invisible.
  const { onPageEnter } = useChrome();
  useLayoutEffect(onPageEnter, [onPageEnter]);

  return (
    <motion.div
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
