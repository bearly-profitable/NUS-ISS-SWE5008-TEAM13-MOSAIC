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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ state, loading, error, refresh }), [state, loading, error, refresh]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
