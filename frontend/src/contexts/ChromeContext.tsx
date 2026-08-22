import { createContext, useContext } from "react";

/**
 * What a page publishes about its own completeness so the shell can offer the
 * Next button.
 *
 * Only a page that can be finished *before* the server knows about it needs
 * one — Company Info, whose form is still a local draft. Everything else is
 * finished by something existing in the workspace, which is exactly what the
 * following step unlocks on, so StepFooter falls back to that.
 */
export interface StepGate {
  ready: boolean;
  /** Runs before navigating — Company Info flushes its form here. Returning
   *  false keeps the operator on the page. */
  onNext?: () => Promise<boolean | void>;
}

export interface ChromeContextValue {
  /** The dock is off-screen because the operator is scrolling down. */
  navHidden: boolean;
  revealNav: () => void;
  /** Called by a page as it mounts: back to the top, dock up. Driven from the
   *  page rather than from the route change, because the outgoing page is
   *  still on screen when the URL changes and must not be yanked to the top
   *  mid-exit. */
  onPageEnter: () => void;
  step: StepGate | null;
}

/** Inert defaults, so a page rendered outside the shell still mounts. */
export const ChromeContext = createContext<ChromeContextValue>({
  navHidden: false,
  revealNav: () => {},
  onPageEnter: () => {},
  step: null,
});

export const useChrome = () => useContext(ChromeContext);

/**
 * Kept out of ChromeContext deliberately: this is a bare setter, so its value
 * never changes and a page registering a gate doesn't re-render every time the
 * dock hides or shows.
 */
export const StepRegistryContext = createContext<(gate: StepGate | null) => void>(() => {});

export const useStepRegistry = () => useContext(StepRegistryContext);
