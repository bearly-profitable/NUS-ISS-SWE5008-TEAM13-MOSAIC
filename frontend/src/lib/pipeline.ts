import { Building2, Layers, Palette, Mail, ShieldCheck, Settings as SettingsIcon, ScrollText } from "lucide-react";
import type { WorkspaceState } from "@/services/workspaceApi";

/**
 * The pipeline, and what has to exist before each step opens.
 *
 * A brand new operator has done nothing yet, so Segments through Approvals
 * would take them to pages that can only say "do the previous step first".
 * Locking them instead makes the order legible, and the same definition
 * drives both the floating nav and the route guard in App.tsx — the nav can
 * never disagree with what a pasted URL actually does.
 *
 * The backend enforces the same order independently (see routers/workspace.py),
 * so this is a wayfinding aid, not the security boundary.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: typeof Building2;
  /** Undefined = always reachable (step 1, and the workspace tools). */
  requires?: (state: WorkspaceState) => boolean;
  /** Shown on the tooltip when locked. */
  requirement?: string;
}

export const PIPELINE: NavItem[] = [
  { to: "/company", label: "Company Info", icon: Building2 },
  {
    to: "/segments",
    label: "Segments",
    icon: Layers,
    requires: (s) => s.company.configured && s.audience_count > 0,
    requirement: "Add your company details and upload a customer CSV first",
  },
  {
    to: "/creative",
    label: "Creative Review",
    icon: Palette,
    requires: (s) => s.segments.length > 0,
    requirement: "Generate segments first",
  },
  {
    to: "/emails",
    label: "Email Review",
    icon: Mail,
    requires: (s) => s.creative_directions.length > 0,
    requirement: "Generate creative direction first",
  },
  {
    to: "/approvals",
    label: "Approval Queue",
    icon: ShieldCheck,
    requires: (s) => s.emails.length > 0,
    requirement: "Compose emails first",
  },
];

export const WORKSPACE_ITEMS: NavItem[] = [
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/logs", label: "Logs", icon: ScrollText },
];

export const NAV_ITEMS = [...PIPELINE, ...WORKSPACE_ITEMS];

/** True when the operator can open this item. Unknown state locks every
 *  gated item rather than flashing them open then closed. */
export function isUnlocked(item: NavItem, state: WorkspaceState | null): boolean {
  if (!item.requires) return true;
  return state ? item.requires(state) : false;
}

/**
 * The step that follows `path`, or null at the end of the pipeline and on the
 * workspace tools.
 *
 * This is what the shell's Next button points at — and because a step is
 * finished exactly when the following one unlocks, `isUnlocked(nextStep(path))`
 * is also the default test for whether to show it at all.
 */
export function nextStep(path: string): NavItem | null {
  const i = PIPELINE.findIndex((step) => step.to === path);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
}
