// What capture.mjs photographs. Each entry is one texture (plus cutouts) for
// a shot in src/timeline.ts — see SPEC.md for which shot uses which.

/** Grow the viewport until `main` (the Console's only scroll container) no
 *  longer scrolls, so a viewport screenshot is the whole page. */
async function unroll(page, { hideChrome = true } = {}) {
  if (hideChrome) {
    await page.addStyleTag({
      content: `[class*="fixed"][class*="bottom"], nav[aria-label], .glass-dock { visibility: hidden !important; }`,
    });
    await page.evaluate(() => {
      // FloatingNav + StepFooter are the absolutely positioned siblings of <main>.
      const main = document.querySelector("main");
      for (const el of main?.parentElement?.children ?? []) if (el !== main) el.style.visibility = "hidden";
    });
  }
  const extra = await page.evaluate(() => {
    const m = document.querySelector("main");
    return m ? m.scrollHeight - m.clientHeight : 0;
  });
  if (extra > 0) await page.setViewportSize({ width: 1920, height: 1080 + extra });
}

const resetViewport = (page) => page.setViewportSize({ width: 1920, height: 1080 });

/** Clicks the first element whose own text matches. */
async function clickText(page, selector, re) {
  await page.evaluate(
    ([sel, src]) => {
      const rx = new RegExp(src);
      const el = [...document.querySelectorAll(sel)].find((e) => rx.test(e.textContent ?? ""));
      el?.click();
    },
    [selector, re.source],
  );
}

/** Removes the Approval Queue's 0.72 preview scale + 420px scroller so the
 *  email renders at its real size, then tags it for a cutout. */
async function fullEmail(page) {
  await page.evaluate(() => {
    const scaler = [...document.querySelectorAll("div")].find((d) => d.style.transform === "scale(0.72)");
    if (!scaler) return;
    scaler.style.transform = "none";
    scaler.style.width = "100%";
    const box = scaler.parentElement;
    box.style.height = "auto";
    box.style.overflow = "visible";
    box.setAttribute("data-cap", "email");
  });
}

const GIFT_SENT_AT = "2026-10-14T01:12:06+08:00";

function withGiftSent(state) {
  const email = state.emails.find((e) => e.segment_brief_id === "seg-gift");
  email.status = "sent";
  state.approvals.push({ id: "appr-gift", scope: "email", approver_name: "Ong Qing Quan", decision: "approved",
    target_id: email.id, created_at: "2026-10-14T01:11:58+08:00" });
  state.sends.unshift({ id: "send-gift", email_id: email.id, segment_brief_id: "seg-gift", recipient: "demo@fcp.com.sg",
    subject: email.subject, status: "sent", provider: "resend", provider_id: "re_7d2c91ab", error: null, created_at: GIFT_SENT_AT });
  return state;
}

function withGiftSentLog(logs) {
  logs.entries.unshift(
    { id: "log-send-gift", kind: "user", actor: "Operator", action: "email.send",
      detail: "Sent “A Thoughtful Fat Cat Gift” to demo@fcp.com.sg", target_type: "artifact", target_id: "email-gift",
      verdict: null, created_at: GIFT_SENT_AT },
    { id: "log-appr-gift", kind: "user", actor: "Ong Qing Quan", action: "approval.grant",
      detail: "Approved “A Thoughtful Fat Cat Gift”", target_type: "artifact", target_id: "email-gift",
      verdict: "PASS", created_at: "2026-10-14T01:11:58+08:00" },
  );
  return logs;
}

export const SHOTS = [
  {
    name: "company",
    path: "/company",
    prepare: async (page) => unroll(page),
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    after: resetViewport,
  },
  {
    name: "segments",
    path: "/segments",
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 6 }],
  },
  {
    name: "segments-empty",
    path: "/segments",
    prepare: async (page) => {
      await page.addStyleTag({ content: "main .glass-card { visibility: hidden !important; }" });
    },
  },
  {
    name: "creative",
    path: "/creative",
    prepare: async (page) => unroll(page),
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 8 }],
    after: resetViewport,
  },
  {
    name: "emails",
    path: "/emails",
    prepare: async (page) => unroll(page),
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 6 }],
    after: resetViewport,
  },
  {
    name: "approvals",
    path: "/approvals",
    prepare: async (page) => unroll(page),
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 12 }],
    after: resetViewport,
  },
  {
    name: "approvals-loyal",
    path: "/approvals",
    prepare: async (page) => {
      await clickText(page, "main button, main [role=button], main .glass-card", /^Loyal Full-Price/);
      await page.waitForTimeout(700);
      await unroll(page);
    },
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 12 }],
    after: resetViewport,
  },
  {
    name: "approvals-view",
    path: "/approvals",
  },
  {
    name: "email-discount",
    path: "/approvals",
    dpr: 3,
    prepare: async (page) => {
      await fullEmail(page);
      await unroll(page);
    },
    cutouts: [{ name: "full", selector: "[data-cap=email]" }],
    after: resetViewport,
  },
  {
    name: "email-loyal",
    path: "/approvals",
    dpr: 3,
    prepare: async (page) => {
      await clickText(page, "main button, main [role=button], main .glass-card", /^Loyal Full-Price/);
      await page.waitForTimeout(700);
      await fullEmail(page);
      await unroll(page);
    },
    cutouts: [{ name: "full", selector: "[data-cap=email]" }],
    after: resetViewport,
  },
  {
    name: "eval",
    path: "/approvals",
    dpr: 3,
    prepare: async (page) => {
      await clickText(page, "main button", /Show scoring detail/);
      await page.waitForTimeout(700);
      await unroll(page);
    },
    cutouts: [{ name: "card", selector: "main .glass-card" }],
    after: resetViewport,
  },
  {
    name: "editor",
    path: "/emails",
    prepare: async (page) => {
      await clickText(page, "main button", /^\s*Edit\s*$/);
      await page.waitForTimeout(1500);
    },
    boxes: [{ key: "rows", selector: 'div[class*="group/block"]', all: true }],
  },
  {
    name: "approvals-gift",
    path: "/approvals",
    prepare: async (page) => {
      await clickText(page, "main button, main [role=button], main .glass-card", /^Seasonal Gift/);
      await page.waitForTimeout(700);
      await unroll(page);
    },
    boxes: [
      { key: "cards", selector: "main .glass-card", all: true },
      { key: "buttons", selector: "main button", all: true },
    ],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 12 }],
    after: resetViewport,
  },
  {
    // The same queue a moment after the operator pressed Send on it.
    name: "approvals-gift-sent",
    path: "/approvals",
    patch: { state: withGiftSent },
    prepare: async (page) => {
      await clickText(page, "main button, main [role=button], main .glass-card", /^Seasonal Gift/);
      await page.waitForTimeout(700);
      await unroll(page);
    },
    boxes: [{ key: "cards", selector: "main .glass-card", all: true }],
    cutouts: [{ name: "card", selector: "main .glass-card", all: true, max: 12 }],
    after: resetViewport,
  },
  {
    name: "logs-sent",
    path: "/logs",
    patch: { logs: withGiftSentLog },
    prepare: async (page) => unroll(page),
    boxes: [{ key: "rows", selector: "main tbody tr", all: true }],
    after: resetViewport,
  },
  {
    name: "logs",
    path: "/logs",
    boxes: [{ key: "rows", selector: "main tbody tr", all: true }],
  },
];
