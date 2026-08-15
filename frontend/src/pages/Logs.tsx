import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  User,
  Bot,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLogs, type LogEntry } from "@/services/workspaceApi";

type Filter = "all" | "user" | "agent";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "user", label: "What I did" },
  { id: "agent", label: "What the agents did" },
];

function VerdictBadge({ verdict }: { verdict: string }) {
  const meta =
    verdict === "PASS"
      ? { icon: ShieldCheck, cls: "glass-badge-pass" }
      : verdict === "REVISE"
        ? { icon: ShieldAlert, cls: "glass-badge-revise" }
        : { icon: ShieldX, cls: "glass-badge-block" };
  const Icon = meta.icon;
  return (
    <span className={`glass-badge ${meta.cls} px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1`}>
      <Icon className="h-3 w-3" /> {verdict}
    </span>
  );
}

export default function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [spend, setSpend] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLogs(200);
      setEntries(res.entries);
      setSpend(res.spend_usd);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ScrollText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
            <p className="text-sm text-muted-foreground">
              Append-only. Your actions and every agent call, newest first — {entries.length} entries.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </motion.div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 glass-card p-1 rounded-2xl">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors",
                filter === f.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          Model spend this session: ${spend.toFixed(4)}
        </span>
      </div>

      {error && <div className="text-xs text-destructive mb-3">{error}</div>}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground/70">
              <th className="px-4 py-3 font-semibold w-8"></th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">By</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
              <th className="px-4 py-3 font-semibold">Verdict</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">When</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Nothing logged yet."}
                </td>
              </tr>
            ) : (
              visible.map((e) => (
                <tr key={e.id} className="glass-table-row border-b border-border/40 last:border-0">
                  <td className="px-4 py-3">
                    {e.kind === "user" ? (
                      <User className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{e.action}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{e.actor}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.detail}</td>
                  <td className="px-4 py-3">
                    {e.verdict ? <VerdictBadge verdict={e.verdict} /> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
