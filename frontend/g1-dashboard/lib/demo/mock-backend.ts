/**
 * In-browser stand-in for the FastAPI backend (backend/app/api/v1/endpoints).
 *
 * Each route below returns the same shape as its real counterpart, backed by the
 * session-scoped state in ./store. Robot-side effects (hot-reload, gestures,
 * SLAM, training on the AGX) are simulated with realistic timing so every
 * screen behaves the way it does when the Thor and G1 are connected.
 */

import { DEMO_FEATURES, DEMO_TENANT_COOKIE, DEMO_USER } from "./config";
import { getState, mutate } from "./store";
import { demoTelemetry } from "./telemetry";
import { AGX_IP, DEFAULT_APP_SETTINGS, DEFAULT_VOICE_PARAMS, nextId, personaRecord, uuid, type DemoState } from "./seed";
import { studioControl, studioPlay, studioStatus } from "./voice-studio";

export interface MockRequest {
  method: string;
  path: string; // path after /api/v1, always starting with "/"
  query: URLSearchParams;
  body: unknown;
  /** The original (unpatched) fetch, for calls that must reach the Next.js server. */
  realFetch: typeof fetch;
}

export interface MockResponse {
  status: number;
  body?: unknown;
}

type Handler = (req: MockRequest, params: Record<string, string>) => MockResponse | Promise<MockResponse>;

const ok = (body: unknown = { success: true }): MockResponse => ({ status: 200, body });
const created = (body: unknown): MockResponse => ({ status: 201, body });
const fail = (status: number, detail: string): MockResponse => ({ status, body: { detail } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoNow = () => new Date().toISOString();

function jsonBody<T = Record<string, unknown>>(req: MockRequest): T {
  return (req.body && typeof req.body === "object" && !(req.body instanceof FormData) ? req.body : {}) as T;
}
function formBody(req: MockRequest): FormData | null {
  return req.body instanceof FormData ? req.body : null;
}

function notify(s: DemoState, type: "info" | "success" | "warning" | "error", message: string) {
  s.notifications.unshift({ id: nextId(), type, message, is_read: false, date: isoNow() });
}

function formatBytes(bytes: number) {
  let v = bytes;
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (v < 1024) return `${v.toFixed(1)} ${unit}`;
    v /= 1024;
  }
  return `${v.toFixed(1)} TB`;
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

// ── Simulations that advance with time (evaluated lazily on each request) ─────

const DOC_PROCESSING_MS = 9_000;

function tickDocuments(s: DemoState) {
  for (const d of s.documents) {
    if (d.status === "processing" && d.processingStartedAt && Date.now() - d.processingStartedAt > DOC_PROCESSING_MS) {
      d.status = "indexed";
      d.chunks_count = Math.max(4, Math.round(d.file_size / 12_000));
      delete d.processingStartedAt;
    }
  }
}

const TRAIN_STAGES = [
  "Generating synthetic positive clips with Piper VITS",
  "Augmenting clips with room impulse responses and background noise",
  "Computing openWakeWord audio features",
  "Training DNN classifier",
  "Evaluating recall / false positives per hour",
  "Exporting ONNX model",
];

function tickWakeJobs(s: DemoState) {
  for (const j of s.wakeJobs) {
    if ((j.status === "running" || j.status === "queued" || j.status === "uploading") && j.simStart && j.simDurationMs) {
      const elapsed = Date.now() - j.simStart;
      if (elapsed < 4_000) j.status = "uploading";
      else if (elapsed < j.simDurationMs) j.status = "running";
      else {
        j.status = "ready";
        j.completed_at = isoNow();
        j.optimal_threshold = 0.6;
        j.recall = Math.round((88 + Math.random() * 7) * 10) / 10;
        j.fpph = Math.round((0.1 + Math.random() * 0.25) * 1000) / 1000;
        j.onnx_path = `/models/wakeword/${j.model_name}.onnx`;
        s.maintenanceMode = false;
        notify(s, "success", `Wake word '${j.wake_phrase}' finished training — ready to deploy.`);
      }
    }
  }
}

const TICKET_PICKUP_MS = 45_000;

function tickTickets(s: DemoState) {
  for (const t of s.tickets) {
    if (t.status === "OPEN" && t.simAdvanceAt && Date.now() > t.simAdvanceAt) {
      t.status = "IN_PROGRESS";
      t.updatedAt = isoNow();
      delete t.simAdvanceAt;
      s.ticketSeq += 1;
      notify(s, "info", `Super Admin updated your ticket '${t.subject}' status to IN_PROGRESS.`);
    }
  }
}

function tickPose(s: DemoState) {
  const p = s.pose;
  const dx = p.targetX - p.x;
  const dy = p.targetY - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0.005) {
    const step = Math.min(dist, 0.06); // ~0.03 m/s at the 2 s poll rate
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
  }
  // Tiny localisation jitter so the pose reads as live
  return { x: p.x + (Math.random() - 0.5) * 0.004, y: p.y + (Math.random() - 0.5) * 0.004 };
}

// ── Personas ──────────────────────────────────────────────────────────────────

function activePersonaPayload(s: DemoState) {
  const p = s.personas.find((x) => x.isActive && !x.isTemplate);
  if (!p) return null;
  let rules: unknown = [];
  try { rules = JSON.parse(p.conversationRules); } catch { /* keep [] */ }
  return {
    identity: { name: p.robotName, company: p.robotCompany, location: p.robotLocation, role: p.robotRole, voice: p.robotVoice },
    system_prompt: p.systemPrompt,
    conversation_rules: rules,
    wake_word: p.wakeWord,
    _db_id: p.id,
    _version: p.version,
    _source: "robot",
  };
}

async function callDemoApi(req: MockRequest, path: string, payload: unknown) {
  const res = await req.realFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data;
}

// ── Chat (Groq) ───────────────────────────────────────────────────────────────

function pickSources(s: DemoState, question: string) {
  const q = question.toLowerCase();
  const docs = s.documents.filter((d) => d.status === "indexed");
  const scored = docs.map((d) => {
    const words = d.name.toLowerCase().replace(/\.[a-z]+$/, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const hits = words.filter((w) => q.includes(w)).length;
    return { d, score: hits + (d.id === 1 ? 0.5 : 0) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ d }, i) => ({
      id: `${d.id}-chunk-${7 + i * 13}`,
      document: d.name,
      page: d.file_type === "pdf" ? 3 + i * 5 : undefined,
      excerpt: `Relevant passage retrieved from ${d.name} by hybrid search (BM25 + dense vectors, reranked).`,
      score: Math.round((0.82 - i * 0.09) * 100) / 100,
    }));
}

// ── Router ────────────────────────────────────────────────────────────────────

const routes: [string, string, Handler][] = [];
const on = (method: string, pattern: string, handler: Handler) => routes.push([method, pattern, handler]);

function match(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.replace(/\/+$/, "").split("/");
  const ap = path.replace(/\/+$/, "").split("/");
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

// Health & dashboard
on("GET", "/health", () => ok({ status: "healthy", version: "demo" }));
on("GET", "/health/telemetry", () => ok(demoTelemetry(getState().startedAt)));
on("GET", "/dashboard/stats", () => {
  const s = getState();
  tickDocuments(s);
  const indexed = s.documents.filter((d) => d.status === "indexed");
  const last = indexed.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return ok({
    totalDocuments: s.documents.length,
    indexedChunks: s.documents.reduce((a, d) => a + (d.chunks_count || 0), 0),
    activeModels: 3,
    queriesToday: 12 + s.sessions.reduce((a, x) => a + x.messages.length, 0),
    storageUsed: formatBytes(s.documents.reduce((a, d) => a + d.file_size, 0)),
    storageTotal: "2 GB",
    lastIndexed: last ? timeAgo(last.created_at) : "-",
  });
});
on("GET", "/dashboard/recent-documents", () =>
  ok(getState().documents.slice(-5).reverse().map((d) => ({ id: d.id, name: d.name, size: formatBytes(d.file_size), date: timeAgo(d.created_at), status: d.status })))
);
on("GET", "/dashboard/recent-activities", () =>
  ok(getState().audit.slice(0, 10).map((a, i) => ({ id: i + 1, action: a.action, target: a.endpoint, time: timeAgo(a.timestamp), type: "info" })))
);
on("GET", "/dashboard/activities", () =>
  ok(getState().audit.slice(0, 10).map((a, i) => ({ id: i + 1, action: a.action, target: a.endpoint, time: timeAgo(a.timestamp), type: "info" })))
);
on("GET", "/dashboard/models", () =>
  ok([
    { name: "llama-3.3-70b-versatile", type: "LLM", status: "active", lastUsed: "Just now" },
    { name: "parakeet-tdt-0.6b", type: "ASR", status: "active", lastUsed: "2 min ago" },
    { name: "kokoro-82m / sarvam", type: "TTS", status: "active", lastUsed: "2 min ago" },
  ])
);

// Tenant
on("GET", "/tenant/profile", () => ok(getState().tenant));
on("PUT", "/tenant/profile", (req) => {
  const body = jsonBody(req);
  const tenant = mutate((s) => {
    for (const k of ["name", "host", "hostEmail", "companyDescription", "companyType", "companyLogo"] as const) {
      if (k in body) (s.tenant as Record<string, unknown>)[k] = body[k];
    }
    s.tenant.updatedAt = isoNow();
    notify(s, "success", "Profile details updated successfully.");
    return s.tenant;
  });
  // Server-rendered chrome (header avatar/name) reads this cookie in demo mode.
  const small = { ...tenant } as Record<string, unknown>;
  if (typeof small.companyLogo === "string" && (small.companyLogo as string).length > 1500) delete small.companyLogo;
  delete small.features;
  document.cookie = `${DEMO_TENANT_COOKIE}=${encodeURIComponent(JSON.stringify(small))}; path=/; SameSite=Lax`;
  return ok(tenant);
});
on("GET", "/tenant/features", () => ok(DEMO_FEATURES));

// Auth & users
on("GET", "/auth/me", () => ok({ id: 1, username: DEMO_USER.name, email: DEMO_USER.email, role: "admin", is_active: 1, tenant_id: DEMO_USER.tenantId }));
on("POST", "/auth/change-password", () => ok({ success: true, message: "Password updated" }));
on("POST", "/auth/forgot-password", () => ok({ success: true, message: "If the email exists, a reset link has been sent." }));
on("POST", "/auth/reset-password", () => ok({ success: true }));
on("GET", "/auth/users", () => ok(getState().users));
on("POST", "/auth/users", (req) => {
  const b = jsonBody<{ username: string; email: string; role: string }>(req);
  return mutate((s) => {
    if (s.users.some((u) => u.username.toLowerCase() === String(b.username).toLowerCase())) return fail(400, "Username already exists");
    if (s.users.some((u) => u.email.toLowerCase() === String(b.email).toLowerCase())) return fail(400, "Email already registered");
    const user = { id: nextId(), username: b.username, email: b.email, role: b.role || "user", is_active: 1, created_at: isoNow(), tenant_id: s.tenant.id, requires_password_change: 1 };
    s.users.push(user);
    return created(user);
  });
});
on("PUT", "/auth/users/:id", (req, { id }) => {
  const b = jsonBody(req);
  return mutate((s) => {
    const u = s.users.find((x) => String(x.id) === id);
    if (!u) return fail(404, "User not found");
    if (b.email !== undefined) u.email = String(b.email);
    if (b.role !== undefined) u.role = String(b.role);
    if (b.is_active !== undefined) u.is_active = Number(b.is_active);
    return ok(u);
  });
});
on("DELETE", "/auth/users/:id", (_req, { id }) =>
  mutate((s) => {
    if (id === "1") return fail(400, "You cannot delete your own account");
    s.users = s.users.filter((u) => String(u.id) !== id);
    return ok({ success: true });
  })
);

// Settings
on("GET", "/settings", () => ok(getState().appSettings));
on("PUT", "/settings", (req) => ok(mutate((s) => (s.appSettings = { ...DEFAULT_APP_SETTINGS, ...s.appSettings, ...jsonBody(req) }))));
on("GET", "/settings/voices", () =>
  ok({
    models: [
      { id: "af_heart", name: "Heart (US, female)", provider: "kokoro", active: getState().voiceModel === "af_heart" },
      { id: "am_michael", name: "Michael (US, male)", provider: "kokoro", active: getState().voiceModel === "am_michael" },
      { id: "bf_emma", name: "Emma (UK, female)", provider: "kokoro", active: getState().voiceModel === "bf_emma" },
    ],
  })
);
on("PUT", "/settings/voices", (req) => {
  const v = String(jsonBody(req).voice_model || "af_heart");
  mutate((s) => (s.voiceModel = v));
  return ok({ success: true, voice_model: v });
});
on("GET", "/settings/language", () => ok({ language: getState().language }));
on("PUT", "/settings/language", async (req) => {
  const code = String(jsonBody(req).language_code || "en");
  await sleep(550); // robot_sync hot-swaps ASR/TTS for the new language
  mutate((s) => {
    s.language = code;
  });
  return ok({ success: true, language: code, message: "Robot language updated — takes effect on the next utterance" });
});
on("GET", "/settings/voice-params", () => ok(getState().voiceParams ?? DEFAULT_VOICE_PARAMS));
on("PUT", "/settings/voice-params", async (req) => {
  await sleep(400);
  const b = jsonBody(req);
  const next = mutate((s) => {
    for (const k of ["english", "indic", "international"] as const) {
      if (b[k]) (s.voiceParams as Record<string, unknown>)[k] = { ...(s.voiceParams as Record<string, Record<string, unknown>>)[k], ...(b[k] as object) };
    }
    return s.voiceParams;
  });
  return ok(next);
});

// Personas
on("GET", "/personas/persona", () => {
  const p = activePersonaPayload(getState());
  return p ? ok(p) : fail(404, "No persona found");
});
on("POST", "/personas/persona", async (req) => {
  const b = jsonBody<{ identity?: Record<string, string>; system_prompt?: string; conversation_rules?: unknown[] }>(req);
  await sleep(700);
  const version = mutate((s) => {
    let p = s.personas.find((x) => x.isActive && !x.isTemplate);
    if (!p) {
      p = personaRecord({ name: "Main Robot Persona", isActive: true });
      s.personas.push(p);
    }
    const id = b.identity || {};
    p.robotName = id.name ?? p.robotName;
    p.robotCompany = id.company ?? p.robotCompany;
    p.robotLocation = id.location ?? p.robotLocation;
    p.robotRole = id.role ?? p.robotRole;
    p.robotVoice = id.voice ?? p.robotVoice;
    p.systemPrompt = b.system_prompt ?? p.systemPrompt;
    p.conversationRules = JSON.stringify(b.conversation_rules ?? []);
    p.version += 1;
    p.syncStatus = "synced";
    p.updatedAt = isoNow();
    return p.version;
  });
  return ok({ success: true, robot_synced: true, message: "Persona hot-reloaded on robot — active immediately", version });
});
on("GET", "/personas", () => ok(getState().personas));
on("POST", "/personas", async (req) => {
  await sleep(300);
  const b = jsonBody(req) as Record<string, unknown>;
  const p = mutate((s) => {
    const rec = personaRecord({ ...(b as object), name: String(b.name || "New Persona"), isActive: false, createdAt: isoNow(), updatedAt: isoNow() });
    rec.isTemplate = false; // anything created from the UI (incl. template clones) lands in the library
    s.personas.push(rec);
    return rec;
  });
  return ok(p);
});
on("PUT", "/personas/:id", async (req, { id }) => {
  await sleep(300);
  const b = jsonBody(req);
  return mutate((s) => {
    const p = s.personas.find((x) => x.id === id);
    if (!p) return fail(404, "Persona not found");
    for (const [k, v] of Object.entries(b)) if (k in p && k !== "id") (p as unknown as Record<string, unknown>)[k] = v;
    p.version += 1;
    p.updatedAt = isoNow();
    if (p.isActive) p.syncStatus = "pending";
    return ok(p);
  });
});
on("DELETE", "/personas/:id", (_req, { id }) =>
  mutate((s) => {
    s.personas = s.personas.filter((p) => p.id !== id);
    return ok({ success: true });
  })
);
on("POST", "/personas/:id/deploy", async (_req, { id }) => {
  await sleep(1100); // push to robot_sync, write persona.json, SIGHUP hot-reload
  return mutate((s) => {
    const p = s.personas.find((x) => x.id === id);
    if (!p) return fail(404, "Persona not found");
    for (const x of s.personas) x.isActive = false;
    p.isActive = true;
    p.syncStatus = "synced";
    p.lastSyncedAt = isoNow();
    notify(s, "success", `Persona '${p.name}' deployed and hot-reloaded on the robot.`);
    return ok({ success: true, robot_synced: true, message: "Persona deployed and hot-reloaded on robot instantly", persona_id: id });
  });
});
on("POST", "/personas/generate", async (req) => {
  const b = jsonBody<{ name?: string; robotName?: string; role?: string; location?: string; context?: string }>(req);
  try {
    const g = (await callDemoApi(req, "/api/demo/persona", b)) as Record<string, unknown>;
    const persona = mutate((s) => {
      const rec = personaRecord({
        name: b.name || `${g.robotName || "Robot"} Generated Profile`,
        robotName: String(g.robotName || b.robotName || ""),
        robotCompany: String(g.robotCompany || ""),
        robotLocation: String(g.robotLocation || b.location || ""),
        robotRole: String(g.robotRole || b.role || ""),
        systemPrompt: String(g.systemPrompt || ""),
        conversationRules: JSON.stringify(Array.isArray(g.conversationRules) ? g.conversationRules : []),
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
      s.personas.push(rec);
      return rec;
    });
    return ok({ success: true, persona });
  } catch (e) {
    return { status: 500, body: `Could not generate the persona: ${e instanceof Error ? e.message : "unknown error"}` };
  }
});

// Wake word models (used by persona role builder)
on("GET", "/wakeword/models", () => ok({ models: getState().wakeModels }));

// Knowledge hub
on("GET", "/documents", () =>
  ok(
    mutate((s) => {
      tickDocuments(s);
      return s.documents.map((d) => ({
        id: d.id, name: d.name, file_type: d.file_type, file_size: d.file_size, size: formatBytes(d.file_size),
        status: d.status, chunks_count: d.chunks_count, created_at: new Date(d.created_at).toLocaleDateString(),
      }));
    })
  )
);
on("POST", "/documents/upload", async (req) => {
  const form = formBody(req);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "No file uploaded");
  await sleep(600);
  const ext = (file.name.split(".").pop() || "txt").toLowerCase();
  const doc = mutate((s) => {
    const d = { id: nextId(), name: file.name, file_type: ext, file_size: file.size || 1024, status: "processing" as const, chunks_count: 0, created_at: isoNow(), processingStartedAt: Date.now() };
    s.documents.push(d);
    return d;
  });
  return ok({ id: doc.id, name: doc.name, size: formatBytes(doc.file_size), type: ext.toUpperCase(), status: "processing", uploadedAt: "Just now", chunks: null });
});
on("DELETE", "/documents/:id", (_req, { id }) =>
  mutate((s) => {
    s.documents = s.documents.filter((d) => String(d.id) !== id);
    return ok({ message: "Document deleted successfully" });
  })
);
on("POST", "/documents/:id/reindex", (_req, { id }) =>
  mutate((s) => {
    const d = s.documents.find((x) => String(x.id) === id);
    if (!d) return fail(404, "Document not found");
    d.status = "processing";
    d.processingStartedAt = Date.now();
    return ok({ message: "Document queued for reindexing", document_id: Number(id) });
  })
);
on("GET", "/documents/:id/progress", (_req, { id }) =>
  mutate((s) => {
    tickDocuments(s);
    const d = s.documents.find((x) => String(x.id) === id);
    if (!d) return fail(404, "Document not found");
    if (d.status === "processing" && d.processingStartedAt) {
      const pct = Math.min(99, Math.round(((Date.now() - d.processingStartedAt) / DOC_PROCESSING_MS) * 100));
      const stage = pct < 25 ? "parsing" : pct < 60 ? "chunking" : pct < 90 ? "embedding" : "indexing";
      return ok({ document_id: d.id, stage, progress_percent: pct, message: `${stage[0].toUpperCase()}${stage.slice(1)}…` });
    }
    return ok({ document_id: d.id, stage: d.status === "indexed" ? "completed" : d.status, progress_percent: d.status === "indexed" ? 100 : 0, message: "No active processing" });
  })
);
on("GET", "/documents/:id/content", (_req, { id }) => {
  const d = getState().documents.find((x) => String(x.id) === id);
  if (!d) return fail(404, "Document not found");
  return ok({
    document_id: d.id,
    metadata: { filename: d.name, file_type: d.file_type, page_count: d.file_type === "pdf" ? 24 : 1 },
    elements_count: d.chunks_count * 3,
    headings: ["Introduction", "Getting started", "Safety guidelines", "Frequently asked questions"],
    tables_count: 3,
    images_count: d.file_type === "pdf" ? 6 : 0,
    lists_count: 9,
    text_preview: `${d.name.replace(/\.[a-z]+$/, "")}\n\nThis document has been parsed, chunked hierarchically and embedded into the vector store, so Veda can cite it when answering visitors.`,
  });
});
on("GET", "/documents/supported-formats", () =>
  ok({
    formats: [
      { extension: ".pdf", name: "PDF", description: "Portable Document Format with text, images, tables" },
      { extension: ".docx", name: "Word Document", description: "Microsoft Word documents with formatting" },
      { extension: ".txt", name: "Plain Text", description: "Plain text files" },
      { extension: ".md", name: "Markdown", description: "Markdown formatted documents" },
      { extension: ".html", name: "HTML", description: "HTML web pages" },
      { extension: ".csv", name: "CSV", description: "Comma-separated values" },
      { extension: ".json", name: "JSON", description: "JSON data files" },
    ],
  })
);
on("GET", "/documents/stats/summary", () => {
  const s = getState();
  tickDocuments(s);
  return ok({
    total: s.documents.length,
    indexed: s.documents.filter((d) => d.status === "indexed").length,
    processing: s.documents.filter((d) => d.status === "processing").length,
    error: s.documents.filter((d) => d.status === "error").length,
    totalSize: s.documents.reduce((a, d) => a + d.file_size, 0),
  });
});

// Chat sessions
const sessionOut = (x: DemoState["sessions"][number]) => ({ id: x.id, title: x.title, user_id: x.user_id, created_at: x.created_at, updated_at: x.updated_at, is_pinned: x.is_pinned });
on("GET", "/sessions", () => ok([...getState().sessions].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(sessionOut)));
on("POST", "/sessions", (req) =>
  mutate((s) => {
    const x = { id: uuid(), title: String(jsonBody(req).title || "New Chat"), user_id: 1, created_at: isoNow(), updated_at: isoNow(), is_pinned: false, messages: [] };
    s.sessions.push(x);
    return created(sessionOut(x));
  })
);
on("GET", "/sessions/:id", (_req, { id }) => {
  const x = getState().sessions.find((y) => y.id === id);
  return x ? ok(sessionOut(x)) : fail(404, "Session not found");
});
on("GET", "/sessions/:id/messages", (_req, { id }) => {
  const x = getState().sessions.find((y) => y.id === id);
  return x ? ok(x.messages) : fail(404, "Session not found");
});
on("PUT", "/sessions/:id", (req, { id }) =>
  mutate((s) => {
    const x = s.sessions.find((y) => y.id === id);
    if (!x) return fail(404, "Session not found");
    x.title = String(jsonBody(req).title || x.title);
    x.updated_at = isoNow();
    return ok(sessionOut(x));
  })
);
on("PUT", "/sessions/:id/pin", (_req, { id }) =>
  mutate((s) => {
    const x = s.sessions.find((y) => y.id === id);
    if (!x) return fail(404, "Session not found");
    x.is_pinned = !x.is_pinned;
    return ok(sessionOut(x));
  })
);
on("DELETE", "/sessions/:id", (_req, { id }) =>
  mutate((s) => {
    s.sessions = s.sessions.filter((y) => y.id !== id);
    return { status: 204 };
  })
);

// Chat — real answers from Groq, grounded in the demo's knowledge base
on("GET", "/chat/models", () => ok({ models: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", provider: "groq" }] }));
on("POST", "/chat", async (req) => {
  const b = jsonBody<{ message?: string; session_id?: string }>(req);
  const message = String(b.message || "").trim();
  if (!message) return fail(400, "Message is required");
  const s = getState();
  const session = b.session_id ? s.sessions.find((x) => x.id === b.session_id) : undefined;
  const history = (session?.messages || []).slice(-8).map((m) => ({ role: m.role, content: m.content }));
  let content: string;
  try {
    const data = (await callDemoApi(req, "/api/demo/chat", {
      message,
      history,
      persona: activePersonaPayload(s),
      documents: s.documents.filter((d) => d.status === "indexed").map((d) => d.name),
      language: s.language,
    })) as { reply?: string };
    content = data.reply || "I'm sorry, I couldn't come up with an answer to that.";
  } catch (e) {
    // Shown as the robot's reply, so a missing key or rate limit never breaks the pitch flow.
    content = `I can't reach my language model right now — ${e instanceof Error ? e.message : "please try again in a moment."}`;
  }
  mutate((st) => {
    const sess = b.session_id ? st.sessions.find((x) => x.id === b.session_id) : undefined;
    if (sess) {
      sess.messages.push({ id: nextId(), role: "user", content: message, created_at: isoNow() });
      sess.messages.push({ id: nextId(), role: "assistant", content, created_at: isoNow() });
      sess.updated_at = isoNow();
    }
  });
  return ok({ message: { role: "assistant", content }, sources: pickSources(s, message), model: "llama-3.3-70b-versatile" });
});

// FRS
on("GET", "/employees", () => ok(getState().employees));
on("POST", "/employees", async (req) => {
  const f = formBody(req);
  const employeeId = String(f?.get("employee_id") || "").trim();
  const name = String(f?.get("name") || f?.get("username") || "").trim();
  const photos = (f?.getAll("photos") || []).filter((p) => p instanceof File);
  if (!employeeId || !name) return fail(400, "Employee ID and name are required");
  if (photos.length === 0) return fail(400, "At least one photo is required");
  await sleep(1400); // face detection + embedding on the Thor
  return mutate((s) => {
    if (s.employees.some((e) => e.employee_id.toLowerCase() === employeeId.toLowerCase())) return fail(400, "Employee ID already exists");
    const emp = {
      id: nextId(), employee_id: employeeId, username: name.replace(/\s+/g, "_"),
      email: String(f?.get("email") || `${name.split(" ")[0].toLowerCase()}@company.com`),
      department: String(f?.get("department") || "") || null, face_id: `face_${employeeId.toLowerCase()}`,
      photo_count: photos.length, is_enrolled: true, is_active: 1, created_at: isoNow(),
    };
    s.employees.push(emp);
    notify(s, "success", `${name} enrolled in face recognition with ${photos.length} photo(s).`);
    return created(emp);
  });
});
on("POST", "/employees/:id/photos", async (req, { id }) => {
  const photos = (formBody(req)?.getAll("photos") || []).filter((p) => p instanceof File);
  await sleep(900);
  return mutate((s) => {
    const e = s.employees.find((x) => x.employee_id === id);
    if (!e) return fail(404, "Employee not found");
    e.photo_count += photos.length;
    e.is_enrolled = true;
    return ok(e);
  });
});
on("DELETE", "/employees/:id", (_req, { id }) =>
  mutate((s) => {
    s.employees = s.employees.filter((e) => e.employee_id !== id);
    return ok({ status: "deleted" });
  })
);
on("POST", "/employees/bulk", async (req) => {
  const file = formBody(req)?.get("file");
  await sleep(1500);
  if (!(file instanceof File)) return fail(400, "No file uploaded");
  const errors: { row: number; employee_id: string; reason: string }[] = [];
  let enrolled = 0;
  if (/\.csv$/i.test(file.name)) {
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const col = (names: string[]) => header.findIndex((h) => names.includes(h));
    const ci = { id: col(["employee_id", "id", "emp_id"]), name: col(["name", "username", "full_name"]), email: col(["email"]), dept: col(["department", "dept"]) };
    mutate((s) => {
      lines.slice(1).forEach((line, i) => {
        const c = line.split(",").map((x) => x.trim());
        const employeeId = ci.id >= 0 ? c[ci.id] : "";
        const name = ci.name >= 0 ? c[ci.name] : "";
        if (!employeeId || !name) return errors.push({ row: i + 2, employee_id: employeeId || "?", reason: "Missing required fields" });
        if (s.employees.some((e) => e.employee_id === employeeId)) return errors.push({ row: i + 2, employee_id: employeeId, reason: "Employee ID already exists" });
        s.employees.push({
          id: nextId(), employee_id: employeeId, username: name.replace(/\s+/g, "_"), email: (ci.email >= 0 && c[ci.email]) || `${name.split(" ")[0].toLowerCase()}@company.com`,
          department: (ci.dept >= 0 && c[ci.dept]) || null, face_id: `face_${employeeId.toLowerCase()}`, photo_count: 1, is_enrolled: true, is_active: 1, created_at: isoNow(),
        });
        enrolled++;
      });
    });
  } else {
    errors.push({ row: 1, employee_id: "-", reason: "Demo: upload a .csv with employee_id, name, email, department columns" });
  }
  return ok({ total: enrolled + errors.length, enrolled, failed: errors.length, errors });
});
on("POST", "/employees/live-feed/ticket", () => ok({ ticket: uuid(), expires_in: 60, max_seconds: 300 }));

// Integrations (MCP)
on("GET", "/mcp", () => ok(getState().mcps));
on("GET", "/mcp/integrations", () => ok(getState().mcps));
on("GET", "/mcp/logos", () => ok({ logos: {} }));
on("POST", "/mcp/configure", async (req) => {
  const b = jsonBody<{ mcpId: string; isEnabled?: boolean; credentials?: Record<string, string> }>(req);
  await sleep(350);
  return mutate((s) => {
    const m = s.mcps.find((x) => x.id === b.mcpId);
    if (!m) return fail(404, "Integration not found");
    if (b.isEnabled !== undefined) m.isEnabled = Boolean(b.isEnabled);
    if (b.credentials) m.credentials = JSON.stringify(b.credentials);
    return ok({ success: true, config: { id: m.id, isEnabled: m.isEnabled } });
  });
});
on("POST", "/mcp/composio-link", (req) => {
  const id = String(jsonBody(req).mcpId || "");
  const m = getState().mcps.find((x) => x.id === id);
  if (!m) return fail(404, "Integration not found");
  const params = new URLSearchParams({ id: m.id, name: m.name });
  return ok({ redirectUrl: `${window.location.origin}/demo-oauth?${params.toString()}` });
});

// Wake word training (simulated AGX run — minutes instead of hours)
const PRESETS = {
  draft: { steps: 30000, n_samples: 5000, label: "Draft (~1.5 hrs)" },
  standard: { steps: 50000, n_samples: 10000, label: "Standard (~2.5 hrs)" },
  production: { steps: 100000, n_samples: 25000, label: "Production (~4.5 hrs)" },
};
const jobOut = (j: DemoState["wakeJobs"][number]) => {
  const { simStart: _a, simDurationMs: _b, ...rest } = j;
  void _a; void _b;
  return rest;
};
on("GET", "/wakeword/presets", () => ok({ presets: PRESETS, backend: "local_agx", agx_ip: AGX_IP }));
on("GET", "/wakeword/jobs", () =>
  mutate((s) => {
    tickWakeJobs(s);
    const jobs = [...s.wakeJobs].sort((a, b) => b.id - a.id);
    const active = jobs.find((j) => ["running", "uploading", "queued"].includes(j.status));
    return ok({ total: jobs.length, jobs: jobs.map(jobOut), active: active ? jobOut(active) : null });
  })
);
on("GET", "/wakeword/jobs/:id", (_req, { id }) => {
  const j = getState().wakeJobs.find((x) => String(x.id) === id);
  return j ? ok(jobOut(j)) : fail(404, `Job ${id} not found`);
});
on("POST", "/wakeword/train", async (req) => {
  const f = formBody(req);
  const phrase = String(f?.get("wake_phrase") || "").toLowerCase().trim();
  const quality = String(f?.get("quality") || "standard") as keyof typeof PRESETS;
  if (!phrase) return fail(400, "wake_phrase is required");
  if (!PRESETS[quality]) return fail(400, `quality must be one of: ${Object.keys(PRESETS)}`);
  const s0 = getState();
  if (s0.wakeJobs.some((j) => ["running", "uploading", "queued"].includes(j.status))) return fail(409, "A training job is already running on the robot. Wait for it to finish or cancel it.");
  await sleep(700);
  const samples = (f?.getAll("samples") || []).filter((x) => x instanceof File).length;
  const durations = { draft: 150_000, standard: 210_000, production: 270_000 };
  const job = mutate((s) => {
    const j = {
      id: Math.max(0, ...s.wakeJobs.map((x) => x.id)) + 1, wake_phrase: phrase, model_name: phrase.replace(/[\s-]+/g, "_"),
      backend: "local_agx", robot_ip: AGX_IP, quality, steps: PRESETS[quality].steps, n_samples: PRESETS[quality].n_samples,
      sample_count: samples, status: "uploading", optimal_threshold: null, recall: null, fpph: null, onnx_path: null,
      kaggle_kernel: null, kaggle_log_url: null, error_message: null, created_at: isoNow(), started_at: isoNow(), completed_at: null,
      simStart: Date.now(), simDurationMs: durations[quality],
    };
    s.wakeJobs.push(j);
    s.maintenanceMode = true;
    return j;
  });
  return ok({ job_id: job.id, status: "queued", wake_phrase: phrase, backend: "local_agx", estimated_minutes: Math.round(durations[quality] / 60_000), message: "Training started on the AGX Thor (NLP pipeline paused for GPU)" });
});
on("GET", "/wakeword/jobs/:id/local-status", (_req, { id }) =>
  mutate((s) => {
    tickWakeJobs(s);
    const j = s.wakeJobs.find((x) => String(x.id) === id);
    if (!j) return fail(404, `Job ${id} not found`);
    const frac = j.simStart && j.simDurationMs ? Math.min(1, (Date.now() - j.simStart) / j.simDurationMs) : j.status === "ready" || j.status === "deployed" ? 1 : 0;
    const step = Math.round(frac * j.steps);
    const stageIdx = Math.min(TRAIN_STAGES.length - 1, Math.floor(frac * TRAIN_STAGES.length));
    const log_tail = TRAIN_STAGES.slice(0, stageIdx + 1).map((st, i) => `[${new Date((j.simStart || Date.now()) + i * 20_000).toLocaleTimeString()}] ${st}${i === stageIdx && frac < 1 ? "…" : " ✓"}`);
    if (frac > 0.5 && frac < 1) log_tail.push(`step ${step}/${j.steps}  loss=${(0.42 * (1 - frac) + 0.03).toFixed(4)}  recall@0.5=${(0.7 + frac * 0.22).toFixed(3)}`);
    const agx_live = { status: frac >= 1 ? "completed" : "training", step, total_steps: j.steps, message: frac >= 1 ? "Model exported" : TRAIN_STAGES[stageIdx], log_tail };
    return ok({ job_id: j.id, db_status: j.status, agx_live, log_tail, progress_pct: Math.round(frac * 100) });
  })
);
on("POST", "/wakeword/jobs/:id/deploy", async (_req, { id }) => {
  await sleep(900);
  return mutate((s) => {
    const j = s.wakeJobs.find((x) => String(x.id) === id);
    if (!j) return fail(404, `Job ${id} not found`);
    if (j.status !== "ready" && j.status !== "deployed") return fail(400, `Job is ${j.status} — only finished models can be deployed`);
    j.status = "deployed";
    if (!s.wakeModels.some((m) => m.name === j.model_name)) s.wakeModels.push({ filename: `${j.model_name}.onnx`, name: j.model_name });
    notify(s, "success", `Wake word '${j.wake_phrase}' deployed to the robot.`);
    return ok({
      job_id: j.id, status: "deployed", onnx_path: j.onnx_path, wake_phrase: j.wake_phrase, threshold: j.optimal_threshold, recall: j.recall,
      robot_config: { wake_word: { model: `${j.model_name}.onnx`, threshold: j.optimal_threshold, phrase: j.wake_phrase } },
    });
  });
});
const cancelJob: Handler = (_req, { id }) =>
  mutate((s) => {
    const j = s.wakeJobs.find((x) => String(x.id) === id);
    if (!j) return fail(404, `Job ${id} not found`);
    j.status = "cancelled";
    delete j.simStart;
    s.maintenanceMode = false;
    return ok({ job_id: j.id, status: "cancelled", message: "Robot maintenance mode ended. NLP pipeline restarting." });
  });
on("DELETE", "/wakeword/jobs/:id", cancelJob);
on("DELETE", "/wakeword/jobs/:id/local-cancel", cancelJob);
on("POST", "/wakeword/jobs/:id/sync", (_req, { id }) =>
  mutate((s) => {
    tickWakeJobs(s);
    const j = s.wakeJobs.find((x) => String(x.id) === id);
    return j ? ok({ message: `Job is ${j.status}`, status: j.status }) : fail(404, `Job ${id} not found`);
  })
);
on("GET", "/wakeword/robot/:ip/status", () => {
  const s = getState();
  tickWakeJobs(s);
  return ok({ reachable: true, maintenance_mode: s.maintenanceMode, pipeline_running: !s.maintenanceMode });
});
on("POST", "/wakeword/robot/:ip/maintenance/:action", async (_req, { action }) => {
  await sleep(800);
  mutate((s) => (s.maintenanceMode = action === "start"));
  return ok({ status: "ok", maintenance_mode: action === "start", pipeline_running: action !== "start" });
});

// Robot & gestures
on("GET", "/robot/status", () =>
  ok({
    thor: { status: "online", note: "implicit — this response could not have been produced if the AGX-hosted stack were unreachable" },
    robot: { status: "online", ip: "192.168.123.164", latency_ms: Math.round(2 + Math.random() * 3) },
  })
);
on("GET", "/gestures/health", () => ok({ status: "ok", robot_sync: "reachable" }));
on("GET", "/gestures/custom", () => ok({ gestures: getState().gestures }));
on("POST", "/gestures/custom/record/start", async (req) => {
  const name = String(jsonBody(req).name || "").trim();
  if (!name) return fail(400, "Gesture name is required");
  if (getState().gestures.some((g) => g.name === name)) return fail(409, `A gesture named '${name}' already exists.`);
  await sleep(600); // motors switch to compliant mode
  mutate((s) => (s.recording = { name, startedAt: Date.now() }));
  return ok({ status: "recording", name });
});
on("POST", "/gestures/custom/record/stop", async () => {
  const rec = getState().recording;
  if (!rec) return fail(400, "No recording in progress");
  await sleep(700);
  return mutate((s) => {
    const duration = Math.max(2, Math.round(((Date.now() - rec.startedAt) / 1000) * 10) / 10);
    const g = { id: uuid(), name: rec.name, duration_s: duration, sample_count: Math.round(duration * 50), created_at: isoNow() };
    s.gestures.push(g);
    s.recording = null;
    return ok({ status: "stopped", gesture: g });
  });
});
on("POST", "/gestures/custom/:name/play", async (_req, { name }) => {
  await sleep(400);
  return getState().gestures.some((g) => g.name === name) ? ok({ status: "playing", name }) : fail(404, `Gesture '${name}' not found`);
});
on("DELETE", "/gestures/custom/:name", (_req, { name }) =>
  mutate((s) => {
    s.gestures = s.gestures.filter((g) => g.name !== name);
    s.communication.names = s.communication.names.filter((n) => n !== name);
    return ok({ status: "deleted", name });
  })
);
on("POST", "/gestures/builtin/:name/play", async (_req, { name }) => {
  await sleep(450);
  return ok({ status: "playing", gesture: name });
});
on("GET", "/gestures/communication", () => ok(getState().communication));
on("PUT", "/gestures/communication", async (req) => {
  const b = jsonBody<{ enabled?: boolean; mode?: "recorded" | "unitree_app"; names?: string[]; unitree_roles?: Record<string, string>; min_reply_chars?: number }>(req);
  await sleep(500);
  return ok(
    mutate((s) => {
      const c = s.communication;
      if (b.mode) c.mode = b.mode;
      if (Array.isArray(b.names)) c.names = b.names.slice(0, 3);
      if (b.unitree_roles) c.unitree_roles = { ...c.unitree_roles, ...b.unitree_roles } as typeof c.unitree_roles;
      if (b.min_reply_chars !== undefined) c.min_reply_chars = b.min_reply_chars;
      if (b.enabled !== undefined) c.enabled = b.enabled;
      return c;
    })
  );
});
on("POST", "/gestures/communication/test", async (req) => {
  const b = jsonBody<{ mode?: string; names?: string[]; unitree_roles?: Record<string, string>; seconds?: number }>(req);
  await sleep(400);
  return ok({ status: "testing", mode: b.mode || "recorded", names: b.names, unitree_roles: b.unitree_roles, seconds: b.seconds ?? 10 });
});
on("POST", "/gestures/communication/verify", async (req) => {
  const roles = (jsonBody(req).unitree_roles || {}) as Record<string, string>;
  await sleep(1500);
  const out: Record<string, { name: string; found: boolean; ret: number }> = {};
  for (const [role, name] of Object.entries(roles)) if (name) out[role] = { name, found: true, ret: 0 };
  return ok(out);
});

// Navigation (SLAM)
on("GET", "/navigation/maps", () => ok({ maps: getState().maps }));
on("GET", "/navigation/locations", () => ok(getState().maps.flatMap((m) => m.waypoints.map((w) => w.name))));
on("POST", "/navigation/slam/map/start", async () => {
  await sleep(900);
  mutate((s) => (s.mapping = true));
  return ok({ status: "mapping", message: "LiDAR SLAM mapping started" });
});
on("POST", "/navigation/slam/map/stop", async (req) => {
  const name = String(jsonBody(req).name || "").trim() || `map_${Date.now()}`;
  await sleep(1200);
  return mutate((s) => {
    const map = { id: uuid(), name, file_path: `/home/unitree/maps/${name}.pcd`, waypoints: [], created_at: isoNow() };
    s.maps.push(map);
    s.mapping = false;
    return ok({ status: { status: "saved", address: map.file_path }, map });
  });
});
on("DELETE", "/navigation/maps/:id", (_req, { id }) =>
  mutate((s) => {
    s.maps = s.maps.filter((m) => m.id !== id);
    return ok({ success: true });
  })
);
on("POST", "/navigation/slam/pose/init", async () => {
  await sleep(1000);
  mutate((s) => (s.pose = { x: 0, y: 0, targetX: 0, targetY: 0 }));
  return ok({ status: "initialized", x: 0, y: 0 });
});
on("GET", "/navigation/slam/pose/current", () => ok(mutate((s) => tickPose(s))));
on("POST", "/navigation/slam/navigate", (req) => {
  const b = jsonBody<{ x: number; y: number }>(req);
  mutate((s) => {
    s.pose.targetX = Number(b.x) || 0;
    s.pose.targetY = Number(b.y) || 0;
  });
  return ok({ status: "navigating", target: { x: b.x, y: b.y } });
});
on("POST", "/navigation/slam/navigate/pause", () =>
  mutate((s) => {
    s.pose.targetX = s.pose.x;
    s.pose.targetY = s.pose.y;
    return ok({ status: "paused" });
  })
);

// Vision (VLM)
on("GET", "/vision", () => ok(getState().vision));
on("PUT", "/vision", async (req) => {
  await sleep(350);
  return ok(mutate((s) => ({ ...(s.vision = { ...s.vision, enabled: Boolean(jsonBody(req).enabled) }) })));
});

// Voice studio — plays through the browser's speech engine as a stand-in for the robot's speaker
on("POST", "/voice-studio/play", (req) => {
  const b = jsonBody<{ items: { id?: string; text: string }[]; language: string }>(req);
  if (!b.items?.length) return fail(400, "Nothing to play");
  return ok(studioPlay(b.items, b.language || "en"));
});
on("POST", "/voice-studio/:action", (_req, { action }) =>
  ["pause", "resume", "stop"].includes(action) ? ok(studioControl(action as "pause" | "resume" | "stop")) : fail(404, "Not found")
);
on("GET", "/voice-studio/status", () => ok(studioStatus()));
on("GET", "/voice-studio/voice", (req) => {
  const lang = req.query.get("language") || "en";
  const vp = getState().voiceParams as typeof DEFAULT_VOICE_PARAMS;
  if (lang === "en") return ok({ language: "en", provider: "kokoro", voice: vp.english.voice, gain: vp.english.gain, speed: vp.english.speed });
  const indic = (vp.indic.language_voices as Record<string, string>)[lang];
  if (indic) return ok({ language: lang, provider: "sarvam", voice: indic, gain: vp.indic.gain, pace: vp.indic.pace, temperature: vp.indic.temperature, language_code: `${lang}-IN` });
  const kokoro = (vp.international.kokoro_language_voices as Record<string, string>)[lang];
  if (kokoro) return ok({ language: lang, provider: "kokoro", voice: kokoro, gain: vp.english.gain, speed: vp.english.speed });
  return ok({ language: lang, provider: "omnivoice", voice: vp.international.omnivoice.default_voice, gain: vp.international.omnivoice.gain, num_step: vp.international.omnivoice.num_step });
});

// Audit & notifications
const auditList = (req: MockRequest) => {
  const s = getState();
  const limit = Number(req.query.get("limit") || 50);
  const offset = Number(req.query.get("offset") || 0);
  return ok({ total: s.audit.length, logs: s.audit.slice(offset, offset + limit) });
};
on("GET", "/audit-logs", auditList);
on("GET", "/audit/logs", auditList);
on("GET", "/notifications", () => ok(getState().notifications));
on("PUT", "/notifications/:id/read", (_req, { id }) =>
  mutate((s) => {
    const n = s.notifications.find((x) => String(x.id) === id);
    if (n) n.is_read = true;
    return ok({ success: true });
  })
);

// Support tickets (backend: /tenant/tickets)
on("GET", "/tenant/tickets", () => ok(mutate((s) => (tickTickets(s), s.tickets))));
on("POST", "/tenant/tickets", (req) => {
  const b = jsonBody<{ name?: string; email?: string; subject?: string; description?: string }>(req);
  if (!b.subject || !b.description) return fail(400, "Missing required fields for ticket");
  return mutate((s) => {
    const t = {
      id: uuid(), tenantId: s.tenant.id, name: b.name || s.tenant.host, email: b.email || s.tenant.hostEmail,
      subject: b.subject!, description: b.description!, status: "OPEN" as const, createdAt: isoNow(), updatedAt: isoNow(),
      simAdvanceAt: Date.now() + TICKET_PICKUP_MS,
    };
    s.tickets.unshift(t);
    notify(s, "info", `Support ticket '${t.subject}' has been submitted.`);
    return ok(t);
  });
});

// ── Audit trail for every successful write ────────────────────────────────────

const AUDIT_SKIP = [/^\/chat/, /^\/sessions/, /^\/voice-studio/, /^\/navigation\/slam\/pose/, /^\/notifications/, /^\/documents\/.*\/progress/];

function recordAudit(req: MockRequest, res: MockResponse) {
  if (req.method === "GET" || res.status >= 400 || AUDIT_SKIP.some((r) => r.test(req.path))) return;
  mutate((s) => {
    s.audit.unshift({
      id: uuid(), action: `${req.method} ${req.path}`, endpoint: `/api/v1${req.path}`, method: req.method,
      status: String(res.status), timestamp: isoNow(), name: DEMO_USER.name, email: DEMO_USER.email, details: {},
    });
    s.audit = s.audit.slice(0, 200);
  });
}

// ── Next.js route handlers that proxy the backend (app/api/tickets, events, wakewords) ──

export function handleNextApi(path: string, method: string, body: unknown): MockResponse | null {
  if (path === "/api/events") {
    return ok(mutate((s) => (tickTickets(s), { seq: s.ticketSeq })));
  }
  if (path === "/api/tickets") {
    if (method === "GET") return ok({ tickets: mutate((s) => (tickTickets(s), s.tickets)) });
    if (method === "POST") {
      const b = (body || {}) as Record<string, string>;
      if (!b.subject || !b.description) return { status: 500, body: { error: "Failed to create ticket" } };
      const res = mutate((s) => {
        const t = {
          id: uuid(), tenantId: s.tenant.id, name: b.name || s.tenant.host, email: b.email || s.tenant.hostEmail,
          subject: b.subject, description: b.description, status: "OPEN" as const, createdAt: isoNow(), updatedAt: isoNow(),
          simAdvanceAt: Date.now() + TICKET_PICKUP_MS,
        };
        s.tickets.unshift(t);
        notify(s, "info", `Support ticket '${t.subject}' has been submitted.`);
        return t;
      });
      recordAudit({ method: "POST", path: "/tenant/tickets", query: new URLSearchParams(), body, realFetch: fetch }, { status: 200 });
      return ok({ ticket: res });
    }
  }
  if (path === "/api/wakewords") return ok({ models: getState().wakeModels });
  return null;
}

export async function handleBackend(req: MockRequest): Promise<MockResponse> {
  const path = req.path.replace(/\/+$/, "") || "/";
  for (const [method, pattern, handler] of routes) {
    if (method !== req.method) continue;
    const params = match(pattern, path);
    if (!params) continue;
    const res = await handler({ ...req, path }, params);
    recordAudit({ ...req, path }, res);
    return res;
  }
  console.warn("[demo] unhandled backend call", req.method, req.path);
  return fail(404, "Not found");
}
