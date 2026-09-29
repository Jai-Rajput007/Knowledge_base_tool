"use client";

// Side-effect import: patches fetch so the dashboard talks to the in-browser demo
// backend. Rendered by the root layout only when NEXT_PUBLIC_DEMO_MODE=true.
import "@/lib/demo/install";

export function DemoBootstrap() {
  return null;
}
