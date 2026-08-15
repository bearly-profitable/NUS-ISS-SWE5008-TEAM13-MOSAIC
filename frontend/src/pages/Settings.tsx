import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Database, KeyRound, Loader2, Plus, Trash2, Save, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { ORCHESTRATOR_BASE } from "@/services/emailApi";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getSettings, updateSettings, type Offer, type WorkspaceSettings } from "@/services/workspaceApi";

type DraftOffer = { id?: string; name: string; terms: string };

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

export default function Settings() {
  const { refresh } = useWorkspace();
  const [orchestratorStatus, setOrchestratorStatus] = useState<"checking" | "up" | "down">("checking");
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [objective, setObjective] = useState("");
  const [offers, setOffers] = useState<DraftOffer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${ORCHESTRATOR_BASE.replace(/\/+$/, "")}/api/health`)
      .then((r) => r.json())
      .then(() => setOrchestratorStatus("up"))
      .catch(() => setOrchestratorStatus("down"));
  }, []);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setObjective(s.objective);
        setOffers(s.offers.map((o: Offer) => ({ id: o.id, name: o.name, terms: o.terms })));
      })
      .catch(() => {
        /* connection status below already surfaces this */
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await updateSettings({
        objective,
        offers: offers.filter((o) => o.name.trim()),
      });
      setSettings(next);
      setOffers(next.offers.map((o) => ({ id: o.id, name: o.name, terms: o.terms })));
      toast.success("Settings saved");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Campaign intent and connection status. The objective and offer catalogue below drive every generation —
          the copy agent may only cite offers listed here.
        </p>
      </motion.div>

      {/* ── Campaign intent ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold">Campaign intent</h2>
        </div>

        <div>
          <Label className="text-xs font-semibold">Objective</Label>
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            className="mt-1.5 text-sm"
            placeholder="e.g. Re-engage lapsed customers with relevant plan upgrades."
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Passed to the creative director and email composer on every run.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Offer catalogue</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setOffers((o) => [...o, { name: "", terms: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add offer
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            Grounding is enforced against this list: an email citing nothing here is BLOCKed, not revised.
          </p>
          <div className="space-y-2">
            {offers.length === 0 && (
              <div className="text-[11px] text-muted-foreground italic py-2">
                No offers — every generated email will be BLOCKed for ungrounded claims.
              </div>
            )}
            {offers.map((offer, i) => (
              <div key={offer.id ?? `new-${i}`} className="flex items-start gap-2">
                <Input
                  value={offer.name}
                  onChange={(e) =>
                    setOffers((list) => list.map((o, idx) => (idx === i ? { ...o, name: e.target.value } : o)))
                  }
                  placeholder="Offer name"
                  className="h-8 text-xs w-52 shrink-0"
                />
                <Input
                  value={offer.terms}
                  onChange={(e) =>
                    setOffers((list) => list.map((o, idx) => (idx === i ? { ...o, terms: e.target.value } : o)))
                  }
                  placeholder="Terms, e.g. Extra 20GB free for 3 months"
                  className="h-8 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setOffers((list) => list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
        </div>
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
            <p className="text-[11px] text-muted-foreground mt-1">
              Only the largest clusters are kept — one email per segment.
            </p>
          </div>
          <div>
            <div className="text-muted-foreground/70 font-medium mb-0.5">Embedding model</div>
            <div className="font-mono text-[11px]">{settings?.embedding_model ?? "—"}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Used for the free-text half of the clustering feature matrix.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
