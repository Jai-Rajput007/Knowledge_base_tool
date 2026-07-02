"use client";

import { useState } from "react";
import { ShieldOff, X, Mail } from "lucide-react";
import { useFeatures } from "./features-context";

interface FeatureGateProps {
  /** The feature key to check against tenant feature flags */
  featureKey: string;
  /** The child element to render. Must accept onClick if you want interception. */
  children: React.ReactNode;
  /**
   * If true, renders children completely hidden when disabled (for sections).
   * If false (default), renders children normally but intercepts clicks to show disclaimer.
   */
  hideWhenDisabled?: boolean;
}

/**
 * FeatureGate — Granular, action-level feature gating.
 *
 * Wrap any button, card, or clickable element. If the feature is disabled:
 * - Default mode: Element is visible but clicking it shows a disclaimer modal.
 * - hideWhenDisabled: Element is not rendered at all.
 *
 * Usage:
 *   <FeatureGate featureKey="generativePersona">
 *     <button onClick={openGenerativeDialog}>Generate ✨</button>
 *   </FeatureGate>
 */
export function FeatureGate({ featureKey, children, hideWhenDisabled = false }: FeatureGateProps) {
  const { isEnabled, loading } = useFeatures();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // While loading, render transparently (don't block the UI)
  if (loading) return <>{children}</>;

  const enabled = isEnabled(featureKey);

  if (enabled) return <>{children}</>;

  // Feature is disabled
  if (hideWhenDisabled) return null;

  return (
    <>
      {/* Intercept wrapper — captures clicks and shows modal instead */}
      <div
        className="relative cursor-not-allowed"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowDisclaimer(true);
        }}
        title="This feature is not enabled for your workspace"
      >
        {/* Subtle lock overlay on hover */}
        <div className="absolute inset-0 z-10 rounded-[inherit] bg-transparent hover:bg-foreground/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/90 border border-foreground/10 shadow-sm">
            <ShieldOff className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest whitespace-nowrap">
              Not Enabled
            </span>
          </div>
        </div>

        {/* Dimmed original content */}
        <div className="pointer-events-none opacity-50 select-none">
          {children}
        </div>
      </div>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowDisclaimer(false)}
        >
          <div
            className="bg-background border border-foreground/10 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowDisclaimer(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ShieldOff className="w-7 h-7 text-amber-500" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                Feature Not Available
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This feature hasn&apos;t been enabled for your workspace. Please reach out to your
                administrator to request access.
              </p>
            </div>

            {/* Contact badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs font-semibold">
              <Mail className="w-3 h-3" />
              Contact admin for this feature
            </div>

            {/* Feature key */}
            <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              feature: {featureKey}
            </p>

            {/* OK button */}
            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
