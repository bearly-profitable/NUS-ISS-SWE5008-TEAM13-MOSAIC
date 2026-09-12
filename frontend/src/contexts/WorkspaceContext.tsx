import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getState, type WorkspaceState } from "@/services/workspaceApi";

/**
 * One shared fetch of the whole console state.
 *
 * Every tab reads from here and calls `refresh()` after a mutation, so a
 * generate on one tab is immediately visible on the next — the old
 * fetch-once-per-page hook meant you had to reload the browser to see new
 * segments or emails.
 */
interface WorkspaceContextValue {
  state: WorkspaceState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Merges a server echo into the cached state without a round trip.
   *
   * `refresh()` refetches the whole console — twelve queries and ~47 KB, most
   * of it emails — which costs about two seconds. That is the right price for
   * a generate, and far too high for a mutation whose response already
   * contains the updated rows. Use this when the server handed back exactly
   * what changed, and `refresh()` when it didn't.
   */
  apply: (patch: Partial<WorkspaceState>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the Orchestrator");
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = useCallback((patch: Partial<WorkspaceState>) => {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ state, loading, error, refresh, apply }),
    [state, loading, error, refresh, apply],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
