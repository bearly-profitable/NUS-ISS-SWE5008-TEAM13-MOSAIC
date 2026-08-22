import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FloatingNav, NavPeekHandle } from "@/components/layout/FloatingNav";
import { StepFooter } from "@/components/layout/StepFooter";
import {
  ChromeContext,
  StepRegistryContext,
  type ChromeContextValue,
  type StepGate,
} from "@/contexts/ChromeContext";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";

/**
 * Stops a file dropped *outside* a drop zone from navigating the tab.
 *
 * The browser default for a dropped file is to open it, which unmounts the
 * app — so a CSV that lands a few pixels off the upload box would throw away
 * everything the operator had typed into the form. Only the real drop zones
 * (see hooks/use-file-drop.ts) handle the event; everything else swallows it.
 */
function useSwallowStrayDrops() {
  useEffect(() => {
    const swallow = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);
}

/**
 * The window: scrolling content, the floating dock, and the Next button.
 *
 * There is no header strip — each page owns its own title, and the pipeline
 * counts it used to show are visible on the pages that produce them.
 *
 * Both bits of chrome are absolutely positioned over the content rather than
 * laid out beside it, so `main` gets bottom padding wide enough that the last
 * row of any page clears them when scrolled to the end. `main` is also the
 * scroll container the dock hides against — the page itself never scrolls.
 */
export function AppShell({ children }: { children: ReactNode }) {
  useSwallowStrayDrops();

  const mainRef = useRef<HTMLElement>(null);
  const { hidden, reveal } = useHideOnScroll(mainRef);
  const [step, setStep] = useState<StepGate | null>(null);

  // A new tab opens at the top with the dock up. Carrying the previous page's
  // offset into a page of a different length lands the operator somewhere
  // arbitrary — and often past the thing they came to see.
  const onPageEnter = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0 });
    reveal();
  }, [reveal]);

  const chrome = useMemo<ChromeContextValue>(
    () => ({ navHidden: hidden, revealNav: reveal, onPageEnter, step }),
    [hidden, reveal, onPageEnter, step],
  );

  return (
    <StepRegistryContext.Provider value={setStep}>
      <ChromeContext.Provider value={chrome}>
        <div className="relative h-full w-full flex flex-col bg-background/40">
          {/* Horizontal overflow is clipped rather than scrolled: the page
              transition slides content in from off the right edge. */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-24">
            {children}
          </main>
          <StepFooter />
          <NavPeekHandle />
          <FloatingNav />
        </div>
      </ChromeContext.Provider>
    </StepRegistryContext.Provider>
  );
}
