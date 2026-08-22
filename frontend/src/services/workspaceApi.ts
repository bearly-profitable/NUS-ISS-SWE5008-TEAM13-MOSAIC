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

/** How the backend classified one column of the uploaded CSV. */
export type ColumnKind = "numeric" | "categorical" | "text" | "identifier" | "constant";

export interface CsvColumn {
  name: string;
  kind: ColumnKind;
  protected: boolean;
  distinct: number;
  sample: string;
}

/**
 * Everything step 1 collects. Every later stage reads from this — segment
 * names, creative direction, email copy, the footer links and which nav
 * items are unlocked.
 */
export interface CompanyProfile {
  name: string;
  website: string;
  description: string;
  campaign_intent: string;
  /** CSV column used as the personalisation merge tag, e.g. "first_name". */
  dynamic_attribute: string;
  logo_url: string;
  hero_image_url: string;
  columns: CsvColumn[];
  csv_filename: string;
  csv_row_count: number;
  uploaded_at: string | null;
  /** Derived: a named company with a stated campaign intent. */
  configured: boolean;
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
  logo_url: string;
  hero_image_url: string;
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
  status: "draft" | "edited" | "approved" | "sent";
  model_version: string | null;
}

/** Which pre-flight group a check belongs to — see backend guardian.py. */
export type CheckCategory = "compliance" | "content" | "deliverability";

/** `block` = must never reach an inbox. `revise` = ship it knowingly if you like. */
export type CheckSeverity = "block" | "revise";

export interface GuardianCheck {
  name: string;
  category: CheckCategory;
  severity: CheckSeverity;
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

/** One real dispatch attempt, successful or not. */
export interface EmailSend {
  id: string;
  email_id: string;
  segment_brief_id: string | null;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  provider: string;
  provider_id: string | null;
  error: string | null;
  created_at: string;
}

/** Whether the backend can actually send, and where from. */
export interface DispatchConfig {
  configured: boolean;
  from_address: string;
  default_recipient: string;
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
  company: CompanyProfile;
  audience_count: number;
  segments: Segment[];
  creative_directions: CreativeDirection[];
  emails: SegmentEmail[];
  /** Latest Guardian verdict per email id. */
  verdicts: Record<string, EmailVerdict>;
  proxy_checks: ProxyCheck[];
  approvals: Approval[];
  sends: EmailSend[];
  offers: Offer[];
  brand_palette: BrandPalette;
  max_segments: number;
  spend_usd: number;
  dispatch: DispatchConfig;
}

/** Settings is connections + generation limits only — campaign intent and the
 *  offer catalogue are collected in step 1 (Company Info). */
export interface WorkspaceSettings {
  brand_palette: BrandPalette;
  openrouter_configured: boolean;
  supabase_configured: boolean;
  resend_configured: boolean;
  resend_from: string;
  default_recipient: string;
  text_model: string;
  embedding_model: string;
  max_segments: number;
}

// ── Calls ────────────────────────────────────────────────────────────────

export const getState = () => request<WorkspaceState>("/api/state");

export const getAudience = (params: { offset?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.limit != null) qs.set("limit", String(params.limit));
  return request<{
    rows: Customer[];
    total: number;
    offset: number;
    limit: number;
    columns: CsvColumn[];
  }>(`/api/audience?${qs.toString()}`);
};

// ── Company info (step 1) ────────────────────────────────────────────────

export const getCompany = () => request<{ company: CompanyProfile; offers: Offer[] }>("/api/company");

export const updateCompany = (patch: {
  name?: string;
  website?: string;
  description?: string;
  campaign_intent?: string;
  dynamic_attribute?: string;
  logo_url?: string;
  hero_image_url?: string;
  offers?: { id?: string; name: string; terms: string }[];
}) =>
  request<{ company: CompanyProfile; offers: Offer[] }>("/api/company", {
    method: "PUT",
    body: JSON.stringify(patch),
  });

/**
 * Uploads the customer base. Returns a job id — parsing, profiling and the
 * insert all run on the server and report steps.
 *
 * Deliberately not routed through `request`: a multipart body must carry the
 * boundary in its own Content-Type header, and setting application/json here
 * would make FastAPI reject the form.
 */
export const uploadAudience = async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${base()}/api/audience/upload`, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.detail ?? text;
    } catch {
      /* not JSON — keep the raw body */
    }
    throw new Error(message || `${res.status} /api/audience/upload`);
  }
  return (await res.json()) as { job_id: string; steps: string[] };
};

export interface JobStep {
  label: string;
  state: "pending" | "running" | "done" | "failed";
  detail: string;
}

export interface Job {
  id: string;
  kind: string;
  status: "running" | "done" | "failed";
  steps: JobStep[];
  error: string | null;
  result: { count?: number } | null;
  started_at: string;
}

/** Returns a job id — segmentation runs on the server and reports steps. */
export const generateSegments = (maxSegments?: number) =>
  request<{ job_id: string; steps: string[] }>("/api/segments/generate", {
    method: "POST",
    body: JSON.stringify({ max_segments: maxSegments ?? null }),
  });

export const getJob = (jobId: string) => request<Job>(`/api/jobs/${jobId}`);

export const generateCreative = () =>
  request<{ job_id: string; steps: string[] }>("/api/creative/generate", { method: "POST" });

export const updateCreative = (segmentId: string, patch: Partial<Omit<CreativeDirection, "segment_brief_id">>) =>
  request<CreativeDirection>(`/api/creative/${segmentId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const generateEmails = (segmentIds?: string[]) =>
  request<{ job_id: string; steps: string[] }>("/api/emails/generate", {
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

/**
 * Dispatches an approved email for real, via Resend.
 *
 * The caller renders `html` with the same generateEmailHtml the builder
 * previews, so what the operator signed off is exactly what ships. The backend
 * fills merge tags from a real contact in the segment before handing it over.
 */
export const sendEmail = (emailId: string, input: { to: string; html: string; subject?: string }) =>
  request<EmailSend>(`/api/emails/${emailId}/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getSettings = () => request<WorkspaceSettings>("/api/settings");

export const updateSettings = (patch: { brand_palette?: Partial<BrandPalette> }) =>
  request<WorkspaceSettings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });

export const getLogs = (limit = 200) =>
  request<{ entries: LogEntry[]; spend_usd: number }>(`/api/logs?limit=${limit}`);
