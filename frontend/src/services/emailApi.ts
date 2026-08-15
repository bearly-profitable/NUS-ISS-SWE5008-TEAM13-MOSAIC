/**
 * Minimal replacement for CampaignOS's orchestratorApi.ts (~900 LOC of
 * CampaignOS-wide API surface we don't need). The email builder only ever
 * used two things from it: the base URL and test-send. Everything else the
 * Console needs talks to our own Python Orchestrator via campaignApi.ts.
 */
export const ORCHESTRATOR_BASE = import.meta.env.VITE_ORCH_API_BASE ?? "";

export async function sendTestEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = ORCHESTRATOR_BASE.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/test-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}
