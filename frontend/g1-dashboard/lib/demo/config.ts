/**
 * Demo mode — a self-contained pitch deployment of the dashboard.
 *
 * When NEXT_PUBLIC_DEMO_MODE=true the app runs without the FastAPI backend,
 * database, MQTT broker or robot: every backend call is answered in the
 * browser by lib/demo/mock-backend.ts, with state kept for the browser session.
 * Only the chat simulator and generative persona reach a real model (Groq),
 * through the server-side routes under app/api/demo/.
 */

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_USER = {
  id: "1",
  email: "jai@gmail.com",
  password: "Jai@#1234",
  name: "Jai Rajput",
  role: "admin" as const,
  tenantId: "ten_demo_001",
  tenantName: "Bidyut Innovation",
};

/** Opaque value of the g1_session cookie in demo mode (no PASETO key needed). */
export const DEMO_SESSION_TOKEN = "demo-session.v1";
export const DEMO_ACCESS_TOKEN = "demo-access-token";

/** Cookie holding profile edits so server-rendered chrome (header avatar) reflects them. */
export const DEMO_TENANT_COOKIE = "g1_demo_tenant";

export const DEMO_TENANT = {
  id: "ten_demo_001",
  name: "Bidyut Innovation",
  host: "Jai Rajput",
  hostEmail: "jai@gmail.com",
  companyDescription:
    "Bidyut Innovation builds VEDA, the operating system for Unitree G1 humanoid robots — knowledge, personas, gestures, navigation and multilingual voice, managed from one dashboard.",
  companyType: "Robotics",
  companyLogo: "",
  features: "{}",
  createdAt: "2026-01-12T09:30:00.000Z",
  updatedAt: "2026-09-20T11:00:00.000Z",
};

/** Every feature flag enabled — the demo shows the full product. */
export const DEMO_FEATURES: Record<string, boolean> = Object.fromEntries(
  [
    "auditing", "chatSimulator", "communicationGestures", "configurationGestures", "emotions",
    "featureSuggestions", "frs", "generativePersona", "healthStats", "internationalLanguage",
    "mcp", "navigation", "otaUpdates", "personaChange", "prebuiltPersonas", "rag", "rbac",
    "rollback", "skillLibrary", "tickets", "vlmVision", "voiceSettings", "voiceStudio",
    "wakeWordSettings",
  ].map((k) => [k, true])
);

export function demoSessionPayload() {
  return {
    sub: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    role: DEMO_USER.role,
    requiresPasswordChange: false,
    tenantId: DEMO_USER.tenantId,
    tenantName: DEMO_USER.tenantName,
  };
}

/** Tenant for server components: defaults merged with the visitor's profile edits (if any). */
export function demoTenantFromCookie(raw: string | undefined) {
  if (!raw) return { ...DEMO_TENANT };
  try {
    return { ...DEMO_TENANT, ...JSON.parse(decodeURIComponent(raw)) };
  } catch {
    return { ...DEMO_TENANT };
  }
}
