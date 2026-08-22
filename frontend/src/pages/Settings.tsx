import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Database, KeyRound } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { ORCHESTRATOR_BASE } from "@/services/emailApi";
import { getSettings, type WorkspaceSettings } from "@/services/workspaceApi";

function StatusRow({
  icon: Icon,
  title,
  hint,
  ok,
  pending,
}: {
  icon: typeof Database;
  title: string;
  hint: string;
  ok: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-xs font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        </div>
      </div>
      {pending ? (
        <span className="text-xs text-muted-foreground">Checking…</span>
      ) : ok ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Connected
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
          <XCircle className="h-4 w-4" /> Not configured
        </span>
      )}
    </div>
  );
}

/**
 * Connections and generation limits only.
 *
 * Campaign intent and the offer catalogue used to live here; they are part of
 * step 1 now (Company Info), so the operator sets up a run in one place
 * rather than half here and half there.
 */
export default function Settings() {
  const [orchestratorStatus, setOrchestratorStatus] = useState<"checking" | "up" | "down">("checking");
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);

  useEffect(() => {
    fetch(`${ORCHESTRATOR_BASE.replace(/\/+$/, "")}/api/health`)
      .then((r) => r.json())
      .then(() => setOrchestratorStatus("up"))
      .catch(() => setOrchestratorStatus("down"));
  }, []);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {
        /* connection status below already surfaces this */
      });
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </motion.div>

      {/* ── Connections ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5 space-y-1"
      >
        <h2 className="text-sm font-bold mb-2">Connections</h2>
        <StatusRow
          icon={Database}
          title="Supabase (workspace data, images)"
          hint="VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
          ok={isSupabaseConfigured}
        />
        <StatusRow
          icon={KeyRound}
          title="Orchestrator API"
          hint="VITE_ORCH_API_BASE — points at the Python backend"
          ok={orchestratorStatus === "up"}
          pending={orchestratorStatus === "checking"}
        />
        <StatusRow
          icon={KeyRound}
          title={`OpenRouter (${settings?.text_model ?? "text model"})`}
          hint="OPENROUTER_API_KEY — set on the backend only, never here"
          ok={Boolean(settings?.openrouter_configured)}
          pending={orchestratorStatus === "checking"}
        />
      </motion.div>

      {/* ── Generation limits ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-bold mb-3">Generation</h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground/70 font-medium mb-0.5">Max segments</div>
            <div className="font-semibold tabular-nums">{settings?.max_segments ?? 6}</div>

          </div>
          <div>
            <div className="text-muted-foreground/70 font-medium mb-0.5">Embedding model</div>
            <div className="font-mono text-[11px]">{settings?.embedding_model ?? "—"}</div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
