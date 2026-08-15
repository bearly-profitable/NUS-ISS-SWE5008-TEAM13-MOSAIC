import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Workspace-level progress strip. There is no campaign selector any more —
 * one implicit workspace — so this shows how far the pipeline has got:
 * audience loaded, segments found, directions written, emails composed and
 * how many are approved.
 */
export function TopBar() {
  const { state, loading, error } = useWorkspace();

  if (error) {
    return (
      <div className="glass-header flex items-center gap-4 px-6 py-3 shrink-0">
        <div className="text-sm text-destructive truncate">{error}</div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="glass-header flex items-center gap-4 px-6 py-3 shrink-0">
        <div className="text-sm text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  const approved = state.approvals.filter((a) => a.decision === "approved").length;

  const stats = [
    { label: "Contacts", value: state.audience_count.toLocaleString() },
    { label: "Segments", value: state.segments.length },
    { label: "Directions", value: state.creative_directions.length },
    { label: "Emails", value: state.emails.length },
    { label: "Approved", value: `${approved}/${state.emails.length}` },
  ];

  return (
    <div className="glass-header flex items-center justify-between gap-4 px-6 py-3 shrink-0">
      <div className="min-w-0">
        <div className="text-sm font-bold text-foreground truncate">MOSAIC Workspace</div>
        <div className="text-[11px] text-muted-foreground truncate max-w-xl">{state.objective}</div>
      </div>

      <div className="flex items-center gap-5 shrink-0">
        {stats.map((s) => (
          <div key={s.label} className="text-right">
            <div className="text-[10px] text-muted-foreground/70">{s.label}</div>
            <div className="text-xs font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
