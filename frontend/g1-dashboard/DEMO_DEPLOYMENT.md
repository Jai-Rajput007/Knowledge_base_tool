# VEDA dashboard — demo deployment (Vercel)

This branch can run the dashboard as a self-contained pitch site: no FastAPI
backend, database, MQTT broker, Thor or robot is needed. It is switched on by one
environment variable, so the normal product build is unaffected.

## Deploy on Vercel

1. **Add New → Project** and import the repository.
2. Pick the branch `demo/vercel` if Vercel asks for one.
3. Set **Root Directory** to `frontend/g1-dashboard`. The framework preset is detected as **Next.js**.
4. Add these **Environment Variables**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_DEMO_MODE` | `true` |
   | `GROQ_API_KEY` | your Groq API key (used only on the server) |

5. Click **Deploy**.

Demo login: **jai@gmail.com** / **Jai@#1234**. The sign-in page shows these credentials and can fill them in with one tap.

## What is real and what is simulated

- **Real AI (Groq, `llama-3.3-70b-versatile`)**: the Chat Simulator and Generative Persona. The key stays server-side in `app/api/demo/*`. Those routes need a signed-in demo session and are rate limited per visitor.
- **Everything else** is answered in the browser by `lib/demo/mock-backend.ts`, using the same response shapes as the FastAPI endpoints. Anything a visitor adds, edits or deletes lasts for their browser session. This includes personas, FRS entries, tickets, documents, integrations, wake-word jobs, gestures, maps, users and settings.
- **Robot-side effects are simulated with realistic timing and data**: persona hot-reload, telemetry, SLAM, gesture recording and training on the AGX.
  - Wake-word training finishes in minutes instead of hours.
  - A new support ticket moves to *IN_PROGRESS* after about 45 seconds.
  - Voice Studio speaks through the browser's speech engine.

## Files

| Path | Purpose |
|---|---|
| `lib/demo/config.ts` | Demo switch, demo account, tenant and feature flags |
| `lib/demo/seed.ts` | Initial data for each visitor session |
| `lib/demo/mock-backend.ts` | In-browser stand-in for every `/api/v1` endpoint |
| `lib/demo/install.ts` | Routes `fetch` calls to the mock (demo mode only) |
| `lib/demo/groq.ts`, `app/api/demo/*` | Server-side Groq calls |
| `app/demo-oauth/` | Simulated OAuth consent for Composio integrations |
| `public/demo/frs-live.svg` | Simulated FRS camera feed |

To run it locally: `NEXT_PUBLIC_DEMO_MODE=true GROQ_API_KEY=... npm run dev`
