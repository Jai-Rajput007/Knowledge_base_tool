/**
 * Server-only Groq client for the demo deployment. The API key comes from the
 * GROQ_API_KEY environment variable (set in Vercel) and never reaches the browser.
 */

import { cookies } from "next/headers";
import { DEMO_SESSION_TOKEN } from "./config";

export const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class DemoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Only signed-in demo visitors may spend Groq tokens. */
export async function requireDemoSession() {
  const store = await cookies();
  if (store.get("g1_session")?.value !== DEMO_SESSION_TOKEN) {
    throw new DemoApiError(401, "Please sign in to use this feature.");
  }
}

// Best-effort per-visitor rate limit (per serverless instance) so a shared
// pitch link can't burn through the Groq quota.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, number[]>();

export function rateLimit(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    throw new DemoApiError(429, "You're sending messages quickly — please wait a few seconds and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
}

export function clientKey(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "anonymous";
}

export async function groqChat(messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new DemoApiError(503, "The AI model is not configured for this deployment (GROQ_API_KEY missing).");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.5,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[demo/groq] upstream error", res.status, detail.slice(0, 300));
    throw new DemoApiError(res.status === 429 ? 429 : 502, res.status === 429 ? "The AI model is busy right now — please try again in a moment." : "The AI model could not answer right now.");
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export function errorResponse(e: unknown) {
  const status = e instanceof DemoApiError ? e.status : 500;
  const message = e instanceof DemoApiError ? e.message : "Something went wrong.";
  return Response.json({ error: message }, { status });
}

/** What the robot knows about the product it runs on — used to ground chat answers. */
export const VEDA_KNOWLEDGE = `
VEDA (by Bidyut Innovation) is the operating system and web dashboard for Unitree G1 humanoid robots. The robot's brain runs fully on-premise on an NVIDIA Jetson AGX Thor (128 GB) mounted on the robot, so conversations, faces and documents never leave the customer's site.

Main capabilities in the dashboard:
- Knowledge Hub (hybrid RAG): upload PDFs, Word, Markdown, CSV, HTML and JSON. Documents are parsed, chunked hierarchically, embedded and indexed; answers combine BM25 keyword search with dense vector search, reranking and section-aware context, and cite their sources. Web RAG can also pull from websites.
- Chat Simulator: test exactly how the robot will answer, with advanced retrieval options (section filters, content types, context strategies).
- Persona manager: ready-made persona templates (receptionist, campus guide, tour guide, medical assistant, retail, museum, warehouse, tutor, security, entertainment), a generative persona builder that writes a full persona from a short description, and a role builder to edit the robot's name, company, location, role, voice, wake word, system prompt and conversation rules. Deploying a persona hot-reloads it on the robot instantly.
- Wake word: train a custom wake phrase (e.g. "Hey Veda") on the AGX Thor itself with draft, standard or production quality, then deploy it to the robot.
- FRS (face recognition): enrol staff with a few photos so the robot greets people by name; bulk import via spreadsheet; live camera feed for administrators.
- Gestures: record custom arm gestures by physically moving the robot's arms in compliant mode, replay them, use built-in gestures (wave, handshake, high five, namaste-style greetings), and pick "communication gestures" the robot performs naturally while speaking long answers.
- Navigation: LiDAR SLAM mapping of a site, saved maps and waypoints, pose initialisation and autonomous navigation to locations.
- Robot Health / Inventory: live telemetry for the Thor (CPU cores, GPU, memory, temperatures, power) and the G1 (battery state of charge and health, cell voltages, IMU, per-joint motor temperatures on a body map).
- Multilingual voice: English plus Hindi, Bengali, Telugu, Tamil, Kannada, Malayalam, Gujarati, Marathi and Punjabi, and international languages such as Japanese, Chinese, Spanish, French, German and Arabic. Voice settings let admins pick voices, speed and pitch per language.
- Voice Studio: queue scripts for the robot to speak through its own speaker, with play, pause and stop.
- Vision (VLM): the robot can look through its camera and describe what it sees when asked.
- Integrations (MCP): connect Gmail, Google Calendar, Drive, Slack, Teams, Zoom, WhatsApp, Jira, weather, news, Wikipedia, web search and more, so the robot can take actions and fetch live information.
- Security & admin: role-based access control (admin, editor, user, viewer), encrypted PASETO sessions, full audit logs, OTA updates with rollback, and a built-in support ticket system.

Voice pipeline on the robot: wake word -> voice activity detection -> speech recognition -> LLM with RAG -> text-to-speech, with barge-in so people can interrupt the robot naturally.
`.trim();
