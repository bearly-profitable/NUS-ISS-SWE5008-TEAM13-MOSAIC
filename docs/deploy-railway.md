# Deploying MOSAIC on Railway

MOSAIC is two deployables plus two managed services it does not host:

| Piece | What it is | Where it runs |
| --- | --- | --- |
| `backend/` | FastAPI Orchestrator (LangGraph, the four agents) | Railway service, Dockerfile |
| `frontend/` | Vite + React Console, a static SPA | Railway service, Nixpacks |
| Supabase | Postgres + the `email-images` storage bucket | Supabase cloud (unchanged) |
| OpenRouter / Resend | Model calls and real email dispatch | External APIs |

Both services build from this one repo, each with its own **Root Directory**.
Deploy the backend first — the Console needs its public URL at build time.

## 1. Backend service

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. Service **Settings → Root Directory**: `backend`.
   Railway then picks up `backend/railway.json` and builds `backend/Dockerfile`.
3. **Settings → Networking → Generate Domain**. Note the URL, e.g.
   `https://mosaic-orchestrator-production.up.railway.app`.
4. **Variables** — everything in `backend/.env.example` except `PORT`:

   ```
   OPENROUTER_API_KEY=sk-or-...
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   OPENROUTER_TEXT_MODEL=openai/gpt-5.6-luna
   OPENROUTER_IMAGE_MODEL=openai/gpt-image-2.5-flare
   OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   RESEND_API_KEY=re_...
   RESEND_FROM=MOSAIC <mosaic@yourdomain.com>
   DEFAULT_RECIPIENT=you@example.com
   FRONTEND_ORIGIN=https://<console-domain>.up.railway.app
   ```

   `FRONTEND_ORIGIN` is filled in after step 2 below — leave it at the
   localhost default for the first deploy and come back to it.

   **Do not set `PORT`.** Railway injects it and the container reads it.

5. Verify: `curl https://<backend-domain>/api/health` →
   `{"status":"ok","openrouter_configured":true,"supabase_configured":true,...}`.
   The same path is the service's healthcheck, so a failed deploy that never
   returns 200 there is rolled back automatically.

## 2. Console service

1. In the **same project**: **New → GitHub Repo**, the same repo again.
2. **Settings → Root Directory**: `frontend` (picks up `frontend/railway.json`).
3. **Variables**, set *before* the first build:

   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   VITE_ORCH_API_BASE=https://<backend-domain>.up.railway.app
   ```

   Vite inlines `VITE_*` at build time. Changing one of these later requires a
   **redeploy**, not a restart — a restart reuses the old bundle.

   Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY` or
   `RESEND_API_KEY` here. Anything `VITE_`-prefixed ships to the browser.

4. **Generate Domain**, then go back to the backend service and set
   `FRONTEND_ORIGIN` to that domain. The backend restarts; without this every
   Console call fails CORS.

## 3. Supabase

Nothing to deploy, but the hosted project must be ready:

- Apply `supabase/migrations/*.sql` in the SQL Editor, in filename order.
- Create the **public** storage bucket `email-images` (see `backend/app/storage.py`).
- Un-pause the project if it is on the free tier and has been idle — a paused
  project withdraws its subdomain from DNS, which the backend reports as
  "Cannot resolve …" rather than a bare 500.

## Operational notes

- **Keep the backend at one replica.** `backend/app/progress.py` holds job
  progress in process memory, so a second replica answers half the
  `GET /api/jobs/{id}` polls with "job not found". `numReplicas: 1` in
  `backend/railway.json` enforces this; raising it needs a shared store first.
- **The filesystem is ephemeral.** Nothing depends on it — campaign state is
  in Supabase and email images go to Supabase Storage — but a restart does
  clear in-flight segmentation jobs.
- **Segmentation is slow** (embeddings → HDBSCAN → one model call per
  segment). It runs on a worker thread and the Console polls, so no HTTP
  timeout is at risk, but the container must not be scaled to zero mid-run.
- **Don't serve the Console through `vite preview`.** `npm run start` uses
  `serve -s dist`, whose SPA fallback makes a hard refresh of `/segments`
  work instead of 404ing. `serve` binds `0.0.0.0` and reads Railway's `PORT`
  from the environment, so neither needs to be passed — and neither should be
  set by hand.

## Local development is unchanged

`./start.ps1` still runs the backend on :8055 and Vite on :5173 from
`backend/.env` and `frontend/.env.local`. The Docker and Nixpacks configs are
only read by Railway.
