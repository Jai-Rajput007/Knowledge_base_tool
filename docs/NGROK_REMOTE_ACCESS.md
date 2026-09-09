# Remote Access to the Veda Dashboard via ngrok

**Purpose**: expose the Veda client dashboard (running on the AGX Thor) to an external
user — a remote client, a demo attendee — over a single public HTTPS URL, with login,
chat, RAG and **document upload** all working.

**Status**: implemented and verified 2026-09-07. Used for the Dubai client demo.

---

## TL;DR — once the setup below is in place

```bash
ssh unitree@192.168.1.107
ngrok http 3000
```

Hand over the printed `https://….ngrok-free.app` URL. That's it — one tunnel serves the
page **and** the API. The ngrok URL may change between runs without needing a rebuild.

---

## 1. Why a naive tunnel does not work

The obvious approach — `ngrok http 3000` with no other changes — **fails**, and it fails
in a way that looks like the site works.

The dashboard is a Next.js app. `NEXT_PUBLIC_*` environment variables are **inlined into
the browser bundle at build time**, not read at runtime. The Thor's build had:

```
NEXT_PUBLIC_API_URL=http://192.168.1.107:8000/api/v1
```

So the remote client's browser downloads the page fine over the tunnel, then every API
call it makes targets `http://192.168.1.107:8000` — a **private LAN address the client
cannot reach**. Login fails, document upload fails, chat fails. The page renders; nothing
in it works.

Tunnelling a second port (8000) does not fix this by itself either: the baked-in URL
still points at the LAN IP, so it needs a rebuild regardless — and then you are also
maintaining two URLs and a CORS configuration.

## 2. The fix: same-origin `/api/v1` proxy

Make the browser call the API on **whatever origin served the page** (a relative
`/api/v1/...`), and let the Next.js server proxy that to the backend on `localhost:8000`.

```
Client browser
   └── https://xxxx.ngrok-free.app/api/v1/documents/upload
         └── ngrok tunnel → Thor :3000 (Next.js)
               └── rewrite → http://localhost:8000/api/v1/documents/upload  (FastAPI)
```

Properties this buys:

- **One tunnel.** Page and API share an origin — no CORS, no second URL.
- **Rebuild-free URL changes.** Nothing is baked in except the relative path `/api/v1`,
  so a new ngrok URL (or LAN access, or localhost) all work off the same build.
- **No new attack surface on the LAN.** Port 8000 was already reachable on the subnet.

### Why the path is `/api/v1` and not `/api`

The app has its **own** route handlers under `app/api/`: `auth`, `events`, `tickets`,
`wakewords`. A blanket `/api/:path*` rewrite would shadow all four and break login.
None of them is named `v1`, and the FastAPI backend mounts everything under
`/api/v1` (`backend/app/main.py:72`), so `/api/v1/:path*` is collision-free.

## 3. Code changes (already committed)

Six files in `frontend/g1-dashboard/`:

| File | Change |
|---|---|
| `next.config.ts` | Added `rewrites()` mapping `/api/v1/:path*` → `${BACKEND_INTERNAL_URL}/:path*` |
| `middleware.ts` | Added `/api/v1` to `BYPASS_PREFIXES` |
| `app/layout.tsx` | Server fetch now reads `BACKEND_INTERNAL_URL` |
| `app/profile/page.tsx` | Server fetch now reads `BACKEND_INTERNAL_URL` |
| `app/api/auth/login/route.ts` | Server fetch now reads `BACKEND_INTERNAL_URL` |
| `app/api/tickets/route.ts` | Server fetch now reads `BACKEND_INTERNAL_URL` |

### Why two variables instead of one

`NEXT_PUBLIC_API_URL` is used in **both** browser and server code. Once it becomes the
relative `/api/v1`, the four server-side call sites above break — Node's `fetch` rejects
a relative URL with `Failed to parse URL`. They therefore read a **server-only**
`BACKEND_INTERNAL_URL` instead.

| Variable | Read by | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | browser bundle | `/api/v1` (relative) |
| `BACKEND_INTERNAL_URL` | Next.js server + the rewrite | `http://localhost:8000/api/v1` |

Every changed line keeps `http://localhost:8000/api/v1` as its fallback default, so if
`BACKEND_INTERNAL_URL` is never set the behaviour is identical to before the change.

### Why `/api/v1` bypasses the auth middleware

`middleware.ts` redirects any request without a `g1_session` cookie to `/sign-in`. Applied
to the proxy path, an API call made before login would receive an **HTML redirect body
instead of JSON**. The backend enforces its own PASETO auth on these routes, so the bypass
removes no protection — it only stops API replies being rewritten into sign-in pages.

---

## 4. Setup procedure

### Step 1 — On the dev PC: commit and push

```bash
cd /home/jai/g1-universe
git add knowledge_base_tool/frontend/g1-dashboard/next.config.ts \
        knowledge_base_tool/frontend/g1-dashboard/middleware.ts \
        knowledge_base_tool/frontend/g1-dashboard/app/layout.tsx \
        knowledge_base_tool/frontend/g1-dashboard/app/profile/page.tsx \
        knowledge_base_tool/frontend/g1-dashboard/app/api/auth/login/route.ts \
        knowledge_base_tool/frontend/g1-dashboard/app/api/tickets/route.ts \
        knowledge_base_tool/NGROK_REMOTE_ACCESS.md
git commit -m "dashboard: same-origin /api/v1 proxy so the UI works behind a tunnel"
git push
```

### Step 2 — On the Thor: pull, then set the env vars by hand

`.env*` is gitignored (`frontend/g1-dashboard/.gitignore:34`), so these two values will
**never** arrive via `git pull`. They must be set on the Thor directly.

```bash
ssh unitree@192.168.1.107
cd ~/veda/knowledge_base_tool && git pull
cd frontend/g1-dashboard

# .env.local takes precedence over .env — update BOTH or the change silently does nothing
sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api/v1|' .env .env.local
grep -q BACKEND_INTERNAL_URL .env       || echo 'BACKEND_INTERNAL_URL=http://localhost:8000/api/v1' >> .env
grep -q BACKEND_INTERNAL_URL .env.local || echo 'BACKEND_INTERNAL_URL=http://localhost:8000/api/v1' >> .env.local
```

### Step 3 — Back up the build, then rebuild and restart

`NEXT_PUBLIC_*` is baked in at build time, so a restart alone changes nothing. `npm run
build` overwrites `.next` **in place**, so back it up first — this is the only step in the
whole procedure that can take the site down.

```bash
cp -r .next .next.bak          # do this FIRST — it is the rollback
npm run build                  # if this errors, do NOT restart; run the rollback below
pm2 restart g1-dashboard       # confirm the process name with `pm2 list`
```

### Step 4 — Verify the proxy locally before tunnelling

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/tenant/profile
```

- **200** — the full proxy path is live. (This endpoint returns 200 directly on `:8000`,
  so a 200 through `:3000` proves the rewrite is doing its job.)
- **404** — the rewrite did not load. Stop; check the build output.
- **307** — the middleware bypass is missing; check `BYPASS_PREFIXES`.

### Step 5 — Open the tunnel

```bash
ngrok http 3000
```

The authtoken is already configured on the Thor
(`/home/unitree/snap/ngrok/430/.config/ngrok/ngrok.yml`).

For a URL that survives restarts, claim the one free static domain at
dashboard.ngrok.com → Domains, then:

```bash
ngrok http 3000 --domain=your-name.ngrok-free.app
```

Keep the terminal open, or run it under `tmux` / `pm2` so it survives the SSH session
closing.

---

## 5. Rollback (takes seconds)

```bash
cd ~/veda/knowledge_base_tool/frontend/g1-dashboard
rm -rf .next && mv .next.bak .next
sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://192.168.1.107:8000/api/v1|' .env .env.local
pm2 restart g1-dashboard
```

No `git revert` needed — the code changes are inert while `NEXT_PUBLIC_API_URL` points at
an absolute URL, because every changed line falls back to `http://localhost:8000/api/v1`.

---

## 6. Blast radius — what this can and cannot affect

Verified before deployment:

| Component | Risk | Why |
|---|---|---|
| **Robot pipeline** (ASR / TTS / LLM / gestures / wakeword) | **None** | Nothing in `g1-nlp` loads the frontend |
| **Robot KB tool call** | **None** | `services/knowledge/kb_client.py:46` calls `http://localhost:8000` directly |
| **Robot MCP tool calls** | **None** | `services/integration/workspace_mcp_client.py:13` calls `http://localhost:8000` directly |
| **FastAPI backend** | **None** | No backend files changed; port 8000 serves exactly as before |
| **RAG / Qdrant / Postgres** | **None** | All behind port 8000 |
| **LAN users of `192.168.1.107:3000`** | Low | Their browser now calls `/api/v1` relative → same Next server → proxy. Works identically |
| **The dashboard build** | **Real** | A failed `npm run build` leaves `.next` unusable. This is what `.next.bak` is for |

The single genuine risk in this procedure is the rebuild. Everything else is either inert
or unreachable from the changed code.

---

## 7. Known limitations

- **Google Workspace OAuth does not work through the tunnel.** "Connect Google" in the MCP
  config modal (`app/features/mcp/components/ConfigModal.tsx:65`) sends the user to an
  OAuth flow whose redirect URI is registered against the LAN address. Google will reject
  the ngrok origin unless it is added in the Google Cloud console. Document upload, chat
  and RAG are unaffected — just do not demo the Google connect flow over the link.

- **ngrok free shows a one-time interstitial.** First page load displays a "You are about
  to visit…" warning; the visitor clicks *Visit Site*. It applies only to HTML navigations,
  not to the `fetch` calls the app makes, so it does not affect login or uploads.

- **The URL is a credential.** Proxying `/api/v1/*` makes the backend reachable through the
  tunnel, and `/api/v1/tenant/profile` currently answers **200 with no auth**. Anyone with
  the URL can reach endpoints that do not check auth. Treat the link as secret and
  `Ctrl-C` the tunnel when the session ends.

- **Free-tier bandwidth and rate limits apply.** Large document uploads travel Dubai →
  ngrok → Thor and will be slower than a LAN upload.

---

## 8. Deployment facts (verified live on the Thor, 2026-09-07)

- Dashboard: `npm run start -H 0.0.0.0 -p 3000` (a **production build**, not dev), managed
  by PM2 (God Daemon, PM2 v7.0.3), cwd `/home/unitree/veda/knowledge_base_tool/frontend/g1-dashboard`
- Backend: `python3` listening on `0.0.0.0:8000`, routers mounted under `/api/v1`
- Super Admin: port 3001, same pattern
- Repo path on the Thor: `~/veda/knowledge_base_tool` (deployed by `git pull`, never scp)
- ngrok: `/snap/bin/ngrok`, authtoken already configured
