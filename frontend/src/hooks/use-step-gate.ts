import { useEffect, useRef } from "react";
import { useStepRegistry } from "@/contexts/ChromeContext";

/**
 * Declares when the current step is finished, so the shell can raise its Next
 * button.
 *
 * `onNext` is read through a ref: it almost always closes over form state, and
 * re-registering the gate on every keystroke would restart the button's
 * entrance animation.
 */
export function useStepGate(ready: boolean, onNext?: () => Promise<boolean | void>) {
  const registerStep = useStepRegistry();
  const handler = useRef(onNext);
  handler.current = onNext;

  useEffect(() => {
    registerStep({ ready, onNext: async () => handler.current?.() });
    return () => registerStep(null);
  }, [registerStep, ready]);
}
