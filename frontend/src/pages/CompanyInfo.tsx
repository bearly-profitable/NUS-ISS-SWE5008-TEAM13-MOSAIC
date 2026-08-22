import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileSpreadsheet,
  Loader2,
  Plus,
  ShieldOff,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProcessPanel } from "@/components/ui/process-panel";
import { useJob } from "@/hooks/use-job";
import { isCsvFile, useFileDrop } from "@/hooks/use-file-drop";
import { useStepGate } from "@/hooks/use-step-gate";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import {
  getAudience,
  getCompany,
  updateCompany,
  uploadAudience,
  type CsvColumn,
  type Customer,
  type Offer,
} from "@/services/workspaceApi";

const PAGE_SIZE = 25;

type DraftOffer = { id?: string; name: string; terms: string };

interface Draft {
  name: string;
  website: string;
  description: string;
  campaign_intent: string;
  dynamic_attribute: string;
}

const EMPTY_DRAFT: Draft = { name: "", website: "", description: "", campaign_intent: "", dynamic_attribute: "" };

/** Columns the personalisation picker offers. A numeric measurement or a
 *  40-word note makes no sense in a greeting, so only short labelled values
 *  are listed — and never a protected attribute. */
function personalisableColumns(columns: CsvColumn[]): CsvColumn[] {
  return columns.filter((c) => !c.protected && (c.kind === "identifier" || c.kind === "categorical"));
}

function Section({
  icon: Icon,
  title,
  hint,
  delay,
  children,
}: {
  icon: typeof Building2;
  title: string;
  hint?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

type SaveState = "idle" | "saving" | "saved";

/** Stands in for the Save button that used to live in the header — the form
 *  now writes itself back, so the only thing left to say is whether it has. */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
      {state === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-success" /> Saved
        </>
      )}
    </span>
  );
}

/** Flattens the jsonb blobs back into the operator's own column order. */
function cellValue(customer: Customer, column: string): string {
  const source =
    customer.structured_attrs?.[column] ??
    customer.behavioural?.[column] ??
    customer.psychographic?.[column];
  if (source === undefined || source === null || source === "") return "—";
  return String(source);
}

export default function CompanyInfo() {
  const { state, refresh } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [offers, setOffers] = useState<DraftOffer[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);

  // Counts operator edits. The autosave below compares the two: they are equal
  // exactly when everything typed so far has reached the server, which is both
  // the "nothing to do" test and the guard against a slow response landing on
  // top of newer keystrokes.
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const editDraft = useCallback((fn: (draft: Draft) => Draft) => {
    revision.current += 1;
    setDraft(fn);
  }, []);
  const editOffers = useCallback((fn: (offers: DraftOffer[]) => DraftOffer[]) => {
    revision.current += 1;
    setOffers(fn);
  }, []);

  const [rows, setRows] = useState<Customer[]>([]);
  const [columns, setColumns] = useState<CsvColumn[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tableLoading, setTableLoading] = useState(true);

  const company = state?.company;

  // Load once. Re-seeding the form from every workspace refresh would throw
  // away whatever the operator is part-way through typing.
  useEffect(() => {
    getCompany()
      .then(({ company: c, offers: o }) => {
        setDraft({
          name: c.name,
          website: c.website,
          description: c.description,
          campaign_intent: c.campaign_intent,
          dynamic_attribute: c.dynamic_attribute,
        });
        setOffers(o.map((offer: Offer) => ({ id: offer.id, name: offer.name, terms: offer.terms })));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load company info"))
      .finally(() => setLoaded(true));
  }, []);

  const fetchPage = useCallback(async (nextOffset: number) => {
    setTableLoading(true);
    try {
      const res = await getAudience({ offset: nextOffset, limit: PAGE_SIZE });
      setRows(res.rows);
      setColumns(res.columns);
      setTotal(res.total);
    } catch {
      /* an empty audience is the normal first-run state, not an error */
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(offset);
  }, [fetchPage, offset]);

  const { job, start, running } = useJob({
    onDone: async () => {
      setOffset(0);
      // The upload clears a personalisation column that the new file doesn't
      // have — pull the server's version rather than keeping a stale pick.
      const [, { company: fresh }] = await Promise.all([fetchPage(0), getCompany()]);
      setDraft((d) => ({ ...d, dynamic_attribute: fresh.dynamic_attribute }));
      await refresh();
    },
    successMessage: (j) => `Uploaded ${(j.result?.count ?? 0).toLocaleString()} contacts`,
  });

  const upload = useCallback(
    (file: File) => {
      void start(() => uploadAudience(file));
    },
    [start],
  );

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so re-picking the same file after a failed parse still
    // fires a change event.
    event.target.value = "";
    if (file) upload(file);
  };

  const { dragging, dropProps } = useFileDrop({
    onFile: upload,
    accept: isCsvFile,
    rejectMessage: "That isn't a CSV — export your customer list as .csv and drop it again",
    disabled: running,
  });

  const saveCompany = useCallback(async (): Promise<boolean> => {
    const at = revision.current;
    if (at === savedRevision.current) return true; // nothing typed since the last write
    setSaveState("saving");
    try {
      const { offers: saved } = await updateCompany({
        ...draft,
        offers: offers.filter((o) => o.name.trim()),
      });
      // Adopt the server's echo — and call the form clean — only if nothing was
      // typed while the request was in flight, or we would overwrite the
      // keystrokes that arrived after it left.
      if (revision.current === at) {
        savedRevision.current = at;
        setOffers(saved.map((o) => ({ id: o.id, name: o.name, terms: o.terms })));
      }
      setSaveState("saved");
      // `configured` gates the rest of the pipeline, so the dock and the Next
      // button need the fresh state, not just the fresh form.
      await refresh();
      return true;
    } catch (err) {
      setSaveState("idle");
      toast.error(err instanceof Error ? err.message : "Could not save");
      return false;
    }
  }, [draft, offers, refresh]);

  // Autosave, in place of the Save button that used to sit in the header.
  // Next saves too, but this page is the only one where work lives purely in
  // the browser — clicking a dock tab mid-form should not throw it away.
  useEffect(() => {
    if (!loaded || revision.current === savedRevision.current) return;
    const timer = window.setTimeout(() => void saveCompany(), 900);
    return () => window.clearTimeout(timer);
  }, [loaded, saveCompany]);

  const audienceCount = state?.audience_count ?? 0;

  // What the backend needs before segmentation can run (see
  // persistence.company_is_configured), phrased for a human.
  const missing = [
    audienceCount === 0 && "a customer CSV",
    !draft.name.trim() && "your company name",
    !draft.campaign_intent.trim() && "a campaign intent",
  ].filter(Boolean) as string[];

  // The shell raises Next once these are filled; clicking it flushes whatever
  // the debounce is still holding before moving on.
  useStepGate(loaded && missing.length === 0, saveCompany);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const displayColumns = columns.filter((c) => c.kind !== "text");
  const pickable = personalisableColumns(columns);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Info</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Everything below feeds the rest of the run — segments, creative direction and the emails themselves.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1 max-w-xs">
          <SaveIndicator state={saveState} />
          {loaded && missing.length > 0 && (
            <div className="glass-badge glass-badge-muted rounded-2xl px-3 py-1.5 text-[11px] flex items-start gap-1.5 text-right">
              <CircleDashed className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>Still needed: {missing.join(" · ")}</span>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {job && <ProcessPanel key="progress" job={job} title="Uploading your customer base" />}
      </AnimatePresence>

      {/* ── 1. Customer base ── */}
      <Section
        icon={FileSpreadsheet}
        title="Customer base"
        hint="Upload a CSV of your customers. Any columns — the pipeline profiles them for you."
        delay={0.04}
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        <button
          type="button"
          disabled={running}
          onClick={() => fileRef.current?.click()}
          {...dropProps}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2.5 py-7 rounded-xl",
            "border-2 border-dashed transition-all group disabled:opacity-60",
            dragging
              ? "border-primary/70 bg-primary/[0.07] text-foreground scale-[1.01]"
              : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.03] text-muted-foreground hover:text-foreground",
          )}
        >
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
              dragging ? "bg-primary/15 text-primary" : "bg-muted/60 group-hover:bg-primary/10",
            )}
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </div>
          <p className="text-xs font-medium">
            {running
              ? "Uploading…"
              : dragging
                ? "Drop to upload"
                : audienceCount
                  ? "Drop a CSV here, or click to replace the customer base"
                  : "Drop your customer CSV here, or click to browse"}
          </p>
          {company?.csv_filename && !running && !dragging && (
            <p className="text-[10px] text-muted-foreground/70">
              Currently loaded: <span className="font-medium">{company.csv_filename}</span> ·{" "}
              {audienceCount.toLocaleString()} contacts
            </p>
          )}
        </button>
        {audienceCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Uploading a new file replaces the audience and clears the segments built from the old one.
          </p>
        )}
      </Section>

      {/* ── 2. Who you are ── */}
      <Section icon={Building2} title="About your company" delay={0.08}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">Company name</Label>
            <Input
              value={draft.name}
              onChange={(e) => editDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Northbank Coffee"
              className="mt-1.5 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Website</Label>
            <Input
              value={draft.website}
              onChange={(e) => editDraft((d) => ({ ...d, website: e.target.value }))}
              placeholder="e.g. northbankcoffee.com"
              className="mt-1.5 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Used for the CTA, the social icons and the footer links in every email.
            </p>
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold">What your company does</Label>
          <Textarea
            value={draft.description}
            onChange={(e) => editDraft((d) => ({ ...d, description: e.target.value }))}
            rows={3}
            className="mt-1.5 text-sm"
            placeholder="e.g. A speciality coffee subscription and three cafés in Melbourne. We sell single-origin beans and brewing gear to home brewers."
          />
        </div>
      </Section>

      {/* ── 3. What this campaign is for ── */}
      <Section
        icon={Target}
        title="Campaign intent"
        hint="What you want this send to achieve."
        delay={0.12}
      >
        <Textarea
          value={draft.campaign_intent}
          onChange={(e) => editDraft((d) => ({ ...d, campaign_intent: e.target.value }))}
          rows={3}
          className="text-sm"
          placeholder="e.g. Win back subscribers who paused in the last quarter, and get regulars onto the new seasonal blend."
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">What you're offering</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => editOffers((o) => [...o, { name: "", terms: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add offer
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            The emails may only reference what is listed here. Anything else is flagged as an ungrounded claim.
          </p>
          <div className="space-y-2">
            {offers.length === 0 && (
              <div className="text-[11px] text-muted-foreground italic py-2">
                No offers yet — emails will be flagged for having nothing concrete to cite.
              </div>
            )}
            {offers.map((offer, i) => (
              <div key={offer.id ?? `new-${i}`} className="flex items-start gap-2">
                <Input
                  value={offer.name}
                  onChange={(e) =>
                    editOffers((list) => list.map((o, idx) => (idx === i ? { ...o, name: e.target.value } : o)))
                  }
                  placeholder="Offer name"
                  className="h-8 text-xs w-52 shrink-0"
                />
                <Input
                  value={offer.terms}
                  onChange={(e) =>
                    editOffers((list) => list.map((o, idx) => (idx === i ? { ...o, terms: e.target.value } : o)))
                  }
                  placeholder="Terms, e.g. 20% off the first month of any subscription"
                  className="h-8 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => editOffers((list) => list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── 4. Personalisation ── */}
      <Section
        icon={UserRound}
        title="Dynamic attribute"
        hint="The column each email greets the reader by."
        delay={0.16}
      >
        {columns.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Upload a CSV first — the columns to choose from come from your own file.
          </p>
        ) : pickable.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            No column in this file suits a greeting. Add one with per-person labels, such as a first name.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {pickable.map((column) => {
                const selected = draft.dynamic_attribute === column.name;
                return (
                  <button
                    key={column.name}
                    type="button"
                    onClick={() =>
                      editDraft((d) => ({ ...d, dynamic_attribute: selected ? "" : column.name }))
                    }
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all duration-150",
                      selected
                        ? "glass-nav-active text-primary border-primary/25"
                        : "glass-badge text-muted-foreground hover:text-foreground",
                    )}
                    title={column.sample ? `e.g. ${column.sample}` : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3 w-3" />
                      {column.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {draft.dynamic_attribute && (
              <p className="text-[11px] text-muted-foreground">
                Emails will open with{" "}
                <code className="font-mono text-primary">{`{{${draft.dynamic_attribute}}}`}</code>, replaced per
                recipient at send.
              </p>
            )}
          </>
        )}
      </Section>

      {/* ── 5. Contact preview ── */}
      {audienceCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-bold">Your contacts</h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {total.toLocaleString()} rows · {displayColumns.length} columns
            </span>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {displayColumns.map((column) => (
                      <th key={column.name} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {column.name}
                          {column.protected && (
                            // Held out of clustering entirely — worth showing,
                            // because it explains why a column never appears
                            // in a segment's feature contributions.
                            <span
                              className="text-[8px] font-bold text-warning normal-case"
                              title="Protected attribute — held out of segmentation"
                            >
                              held out
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-semibold">Consent</th>
                    <th className="px-3 py-2.5 font-semibold min-w-[220px]">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={displayColumns.length + 2} className="px-3 py-8 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline" />
                      </td>
                    </tr>
                  ) : (
                    rows.map((customer) => (
                      <tr key={customer.id} className="glass-table-row border-b border-border/40 last:border-0">
                        {displayColumns.map((column) => (
                          <td key={column.name} className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                            {cellValue(customer, column.name)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          {customer.consent_state === "withdrawn" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                              <ShieldOff className="h-3 w-3" /> withdrawn
                            </span>
                          ) : (
                            <span className="text-[10px] text-success font-semibold">active</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-muted-foreground max-w-md truncate"
                          title={customer.free_text}
                        >
                          {customer.free_text || "—"}
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
              Page {page} of {pageCount}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={offset === 0 || tableLoading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={offset + PAGE_SIZE >= total || tableLoading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
