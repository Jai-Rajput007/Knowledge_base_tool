/**
 * Installs the demo backend: wraps window.fetch so every call the dashboard
 * makes to the FastAPI backend (anything under /api/v1, on any host) and to the
 * Next.js proxy routes that forward to it (/api/tickets, /api/events,
 * /api/wakewords) is answered in the browser. All other requests — pages,
 * assets, /api/auth/*, and the Groq routes under /api/demo — go to the network.
 *
 * Imported for its side effect by app/components/demo-bootstrap.tsx, which the
 * root layout renders only when NEXT_PUBLIC_DEMO_MODE=true.
 */

import { IS_DEMO } from "./config";
import { handleBackend, handleNextApi, type MockResponse } from "./mock-backend";
import { mutate } from "./store";

declare global {
  interface Window {
    __vedaDemoInstalled?: boolean;
  }
}

const NEXT_PROXY_ROUTES = new Set(["/api/events", "/api/tickets", "/api/wakewords"]);
// Endpoints polled on a timer answer instantly; everything else gets a short, realistic network delay.
const INSTANT = [/\/health\/telemetry$/, /\/slam\/pose\/current$/, /\/robot\/status$/, /\/voice-studio\/status$/];

function toResponse(res: MockResponse): Response {
  const noBody = res.status === 204 || res.body === undefined;
  if (typeof res.body === "string") {
    return new Response(res.body, { status: res.status, headers: { "Content-Type": "text/plain" } });
  }
  return new Response(noBody ? null : JSON.stringify(res.body), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const raw = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
  if (raw == null) return undefined;
  if (raw instanceof FormData) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function install() {
  if (!IS_DEMO || typeof window === "undefined" || window.__vedaDemoInstalled) return;
  window.__vedaDemoInstalled = true;

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return realFetch(input, init);
    }
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    const apiIdx = url.pathname.indexOf("/api/v1");
    if (apiIdx >= 0) {
      const path = url.pathname.slice(apiIdx + "/api/v1".length) || "/";
      const body = await readBody(input, init);
      if (!INSTANT.some((r) => r.test(path))) await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
      const res = await handleBackend({ method, path, query: url.searchParams, body, realFetch });
      return toResponse(res);
    }

    if (url.origin === window.location.origin && NEXT_PROXY_ROUTES.has(url.pathname)) {
      const res = handleNextApi(url.pathname, method, await readBody(input, init));
      if (res) return toResponse(res);
    }

    return realFetch(input, init);
  };

  // Simulated third-party OAuth (Composio apps): the consent page opens in a new
  // tab and reports back here, where the integration is marked connected.
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("veda-demo-oauth");
    channel.onmessage = (event: MessageEvent<{ id?: string }>) => {
      const id = event.data?.id;
      if (!id) return;
      mutate((s) => {
        const m = s.mcps.find((x) => x.id === id);
        if (m) m.isEnabled = true;
      });
      window.postMessage("google_auth_success", window.location.origin);
    };
  }
}

install();
