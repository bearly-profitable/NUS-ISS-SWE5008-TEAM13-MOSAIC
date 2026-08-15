import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, Loader2, Download, Search, ChevronLeft, ChevronRight, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAudience, loadAudience, type Customer } from "@/services/workspaceApi";

const PAGE_SIZE = 25;

/** Columns pulled out of the nested jsonb blobs for the table view. */
const COLUMNS: { key: string; label: string; from: "structured" | "behavioural" | "psychographic" }[] = [
  { key: "plan_type", label: "Plan", from: "structured" },
  { key: "data_tier", label: "Data", from: "structured" },
  { key: "monthly_spend_sgd", label: "Spend", from: "structured" },
  { key: "contract_tenure_months", label: "Tenure", from: "structured" },
  { key: "churn_risk_score", label: "Churn risk", from: "behavioural" },
  { key: "price_sensitivity", label: "Price sens.", from: "psychographic" },
  { key: "loyalty_score", label: "Loyalty", from: "psychographic" },
];

function cellValue(customer: Customer, col: (typeof COLUMNS)[number]) {
  const source =
    col.from === "structured"
      ? customer.structured_attrs
      : col.from === "behavioural"
        ? customer.behavioural
        : customer.psychographic;
  const value = source?.[col.key];
  if (value === undefined || value === null) return "—";
  return String(value);
}

export default function Audience() {
  const { state, refresh } = useWorkspace();
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingBase, setLoadingBase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (nextOffset: number, nextQuery: string) => {
    setLoading(true);
    try {
      const res = await getAudience({ offset: nextOffset, limit: PAGE_SIZE, search: nextQuery || undefined });
      setRows(res.rows);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the audience");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(offset, query);
  }, [fetchPage, offset, query]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      setQuery(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLoadBase = async () => {
    setLoadingBase(true);
    try {
      const res = await loadAudience(5000);
      toast.success(`Loaded ${res.loaded.toLocaleString()} contacts`);
      setOffset(0);
      await Promise.all([fetchPage(0, query), refresh()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoadingBase(false);
    }
  };

  const audienceCount = state?.audience_count ?? 0;
  const withdrawn = rows.filter((r) => r.consent_state === "withdrawn").length;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audience</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The fixed M1 synthetic customer base — 5,000 fabricated telco profiles, identical on every load, so
            segmentation runs stay comparable. No real customer data is used anywhere.
          </p>
        </div>
        <Button onClick={handleLoadBase} disabled={loadingBase} variant={audienceCount ? "outline" : "default"} className="gap-2 shrink-0">
          {loadingBase ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {audienceCount ? "Reload base" : "Load audience"}
        </Button>
      </motion.div>

      {audienceCount === 0 && !loading && (
        <div className="glass-card p-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-sm font-bold">No audience loaded yet</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
            Load the base to attach all 5,000 synthetic contacts to this workspace. Everything downstream —
            segments, creative, emails — is derived from these rows.
          </p>
        </div>
      )}

      {audienceCount > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: "Contacts loaded", value: audienceCount.toLocaleString() },
              { label: "Matching current filter", value: total.toLocaleString() },
              { label: "Withdrawn consent (this page)", value: withdrawn },
            ].map((s) => (
              <div key={s.label} className="metric-card">
                <div className="text-[11px] text-muted-foreground/70 font-medium mb-1.5">{s.label}</div>
                <div className="text-xl font-bold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="relative mb-3">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer notes…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {error && <div className="text-xs text-destructive mb-3">{error}</div>}

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    <th className="px-3 py-2.5 font-semibold">ID</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-3 py-2.5 font-semibold whitespace-nowrap">{c.label}</th>
                    ))}
                    <th className="px-3 py-2.5 font-semibold">Consent</th>
                    <th className="px-3 py-2.5 font-semibold min-w-[240px]">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 3} className="px-3 py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 3} className="px-3 py-8 text-center text-muted-foreground">
                        No contacts match “{query}”.
                      </td>
                    </tr>
                  ) : (
                    rows.map((c) => (
                      <tr key={c.id} className="glass-table-row border-b border-border/40 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                          {c.id.split(":").pop()}
                        </td>
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            {cellValue(c, col)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          {c.consent_state === "withdrawn" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                              <ShieldOff className="h-3 w-3" /> withdrawn
                            </span>
                          ) : (
                            <span className="text-[10px] text-success font-semibold">active</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-md truncate" title={c.free_text}>
                          {c.free_text}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Page {page} of {pageCount} · {total.toLocaleString()} contacts
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
