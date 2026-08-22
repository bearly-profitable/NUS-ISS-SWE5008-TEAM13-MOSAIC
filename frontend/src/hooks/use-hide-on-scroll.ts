import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** Travel below this is ignored, so trackpad jitter and the rubber-band at
 *  the end of a fling can't flip the dock. */
const JITTER = 6;
/** The dock always stays up this close to the top — a page that can only
 *  scroll a little should never be able to hide it. */
const TOP_ZONE = 48;

/**
 * Hides floating chrome while the operator scrolls down, and brings it back
 * the moment they scroll up.
 *
 * Watches a scroll container rather than the window: the console's scroller
 * is `main` inside the rounded app shell, and the page itself never scrolls.
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false);
  const anchor = useRef(0);

  const reveal = useCallback(() => {
    anchor.current = ref.current?.scrollTop ?? 0;
    setHidden(false);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    anchor.current = el.scrollTop;

    const onScroll = () => {
      const y = el.scrollTop;
      const delta = y - anchor.current;
      // Under the jitter floor the anchor is deliberately left where it is,
      // so a slow drag still accumulates into a decision rather than never
      // reaching one.
      if (Math.abs(delta) < JITTER) return;
      anchor.current = y;
      setHidden(delta > 0 && y > TOP_ZONE);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  return { hidden, reveal };
}
