import { ORCHESTRATOR_BASE } from "@/services/emailApi";
import type { EmailBlock, EmailBackground } from "@/types/email-builder";

const base = () => ORCHESTRATOR_BASE.replace(/\/+$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    // FastAPI puts the useful message in `detail`; fall back to raw text.
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.detail) message = parsed.detail;
    } catch {
      /* not JSON — keep the raw body */
    }
    // A bare "Not Found" is almost always a stale backend still serving the
    // pre-revamp routes, or the Console pointed at the wrong port. Say so,
    // because the message alone sends you looking in the wrong place.
    if (res.status === 404) {
      throw new Error(
        `404 ${path} — the Orchestrator at ${base()} doesn't have this route. ` +
          "Restart the backend (it may still be running the old code) and check " +
          "VITE_ORCH_API_BASE in frontend/.env.local matches its port.",
      );
    }
    throw new Error(message || `${res.status} ${path}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────

export interface BrandPalette {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

export interface Customer {
  id: string;
  structured_attrs: Record<string, string | number | boolean>;
  behavioural: Record<string, number>;
  psychographic: Record<string, number>;
  free_text: string;
  consent_state: "active" | "withdrawn";
  segment_brief_id: string | null;
}

export interface Segment {
  id: string;
  name: string;
  motivation: string;
  tone_guidance: string;
  size: number;
  confidence: number;
  rationale: string;
  feature_contributions: { feature: string; weight: number }[];
}

export interface CreativeDirection {
  segment_brief_id: string;
  tonality: string;
  language_style: string;
  cta_style: string;
  design_style: string;
  palette: Partial<BrandPalette>;
  rationale: string;
  model_version: string | null;
}

export interface SegmentEmail {
  id: string;
  segment_brief_id: string;
  subject: string;
  preheader: string;
  blocks: EmailBlock[];
  background: EmailBackground | null;
  cited_offer_ids: string[];
  status: "draft" | "edited" | "approved";
  model_version: string | null;
}

export interface GuardianCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export type Verdict = "PASS" | "REVISE" | "BLOCK";

export interface Approval {
  id: string;
  scope: string;
  approver_name: string;
  decision: string;
  target_id: string | null;
  created_at: string;
}

export interface Offer {
  id: string;
  name: string;
  terms: string;
}

export interface ProxyCheck {
  segment_brief_id: string;
  protected_attribute: string;
  correlation: number;
  flagged: boolean;
}

export interface ManipulationScore {
  message_id: string;
  urgency: number;
  scarcity: number;
  loss_framing: number;
  social_proof: number;
  total: number;
  threshold_breached: boolean;
}

export interface LogEntry {
  id: string;
  kind: "user" | "agent";
  actor: string;
  action: string;
  detail: string;
  target_type: string | null;
  target_id: string | null;
  verdict: Verdict | null;
  created_at: string;
}

export interface EmailVerdict {
  verdict: Verdict | null;
  checks: GuardianCheck[];
  created_at: string;
}

export interface WorkspaceState {
  audience_count: number;
  segments: Segment[];
  creative_directions: CreativeDirection[];
  emails: SegmentEmail[];
  /** Latest Guardian verdict per email id. */
  verdicts: Record<string, EmailVerdict>;
  proxy_checks: ProxyCheck[];
  manipulation_scores: ManipulationScore[];
  approvals: Approval[];
  offers: Offer[];
  objective: string;
  brand_palette: BrandPalette;
  max_segments: number;
  spend_usd: number;
}

export interface WorkspaceSettings {
  objective: string;
  brand_palette: BrandPalette;
  offers: Offer[];
  openrouter_configured: boolean;
  supabase_configured: boolean;
  text_model: string;
  embedding_model: string;
  max_segments: number;
}

// ── Calls ────────────────────────────────────────────────────────────────

export const getState = () => request<WorkspaceState>("/api/state");

export const getAudience = (params: { offset?: number; limit?: number; search?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  return request<{ rows: Customer[]; total: number; offset: number; limit: number }>(
    `/api/audience?${qs.toString()}`,
  );
};

export const loadAudience = (count = 5000) =>
  request<{ loaded: number }>("/api/audience/load", {
    method: "POST",
    body: JSON.stringify({ count }),
  });

export const generateSegments = (maxSegments?: number) =>
  request<{ segments: Segment[] }>("/api/segments/generate", {
    method: "POST",
    body: JSON.stringify({ max_segments: maxSegments ?? null }),
  });

export const generateCreative = () =>
  request<{ creative_directions: CreativeDirection[] }>("/api/creative/generate", { method: "POST" });

export const updateCreative = (segmentId: string, patch: Partial<Omit<CreativeDirection, "segment_brief_id">>) =>
  request<CreativeDirection>(`/api/creative/${segmentId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const generateEmails = (segmentIds?: string[]) =>
  request<{ emails: SegmentEmail[] }>("/api/emails/generate", {
    method: "POST",
    body: JSON.stringify({ segment_ids: segmentIds ?? null }),
  });

export const updateEmail = (
  emailId: string,
  patch: { subject?: string; preheader?: string; blocks?: EmailBlock[]; background?: EmailBackground },
) =>
  request<{ email: SegmentEmail; verdict: { message_id: string; verdict: Verdict; checks: GuardianCheck[] } }>(
    `/api/emails/${emailId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

export const readjudicateEmail = (emailId: string) =>
  request<{ message_id: string; verdict: Verdict; checks: GuardianCheck[] }>(
    `/api/emails/${emailId}/adjudicate`,
    { method: "POST" },
  );

export const approveEmail = (targetId: string) =>
  request<Approval>("/api/approvals", {
    method: "POST",
    body: JSON.stringify({ target_id: targetId }),
  });

export const revokeApproval = (targetId: string) =>
  request<{ revoked: string }>(`/api/approvals/${targetId}`, { method: "DELETE" });

export const getSettings = () => request<WorkspaceSettings>("/api/settings");

export const updateSettings = (patch: {
  objective?: string;
  brand_palette?: Partial<BrandPalette>;
  offers?: { id?: string; name: string; terms: string }[];
}) => request<WorkspaceSettings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });

export const getLogs = (limit = 200) =>
  request<{ entries: LogEntry[]; spend_usd: number }>(`/api/logs?limit=${limit}`);
