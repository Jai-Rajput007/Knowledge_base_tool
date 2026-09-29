"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";

// Demo deployment only: stands in for Composio's OAuth consent screen. On
// approval it tells the dashboard tab (via BroadcastChannel) to mark the
// integration connected, exactly as the real OAuth callback would.

function Consent() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const name = params.get("name") || "this app";
  const [state, setState] = useState<"idle" | "connecting" | "done">("idle");

  const approve = () => {
    setState("connecting");
    setTimeout(() => {
      try {
        new BroadcastChannel("veda-demo-oauth").postMessage({ id });
      } catch {
        /* older browsers: the dashboard picks it up on next refresh */
      }
      setState("done");
      setTimeout(() => window.close(), 1600);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Secure connection via Composio</p>
            <h1 className="text-lg font-bold text-foreground">Connect {name} to Veda</h1>
          </div>
        </div>

        {state === "done" ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-500">
              <Check className="h-7 w-7" />
            </div>
            <p className="font-semibold text-foreground">{name} connected</p>
            <p className="mt-1 text-sm text-muted-foreground">You can close this tab and return to the dashboard.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Veda (Bidyut Innovation) is requesting permission to:
            </p>
            <ul className="mb-6 space-y-2 text-sm text-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Read information from your {name} account</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Take actions in {name} when you ask the robot to</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Keep access until you disconnect it from the dashboard</li>
            </ul>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button onClick={() => window.close()} className="h-11 flex-1 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={approve}
                disabled={state === "connecting"}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {state === "connecting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</> : "Allow access"}
              </button>
            </div>
            <p className="mt-5 text-center text-[11px] text-muted-foreground">Demo environment — no real account is accessed.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DemoOAuthPage() {
  return (
    <Suspense fallback={null}>
      <Consent />
    </Suspense>
  );
}
