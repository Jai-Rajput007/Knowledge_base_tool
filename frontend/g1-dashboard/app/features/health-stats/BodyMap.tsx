"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { JOINT_GROUPS, JOINT_NAMES, JOINT_TEMP_WARN_C, JOINT_TEMP_CRIT_C } from "./types";

gsap.registerPlugin(useGSAP);

// Severity palette is deliberately fixed rather than themed: this panel paints
// its own dark instrument-panel ground, so the greens/ambers/reds must be
// tuned for that ground and not for the surrounding page theme.
const OK = "#34d399";
const WARN = "#fbbf24";
const CRIT = "#f87171";
const IDLE = "#64748b";

function severityColor(temp: number | null): string {
  if (temp === null) return IDLE;
  if (temp >= JOINT_TEMP_CRIT_C) return CRIT;
  if (temp >= JOINT_TEMP_WARN_C) return WARN;
  return OK;
}

// The robot render is 1071x3078 in its own pixel space. The canvas is widened
// to 2111 so the temperature callouts have room to sit clear of the body on
// both sides; the render is centred in that canvas at ROBOT_X.
const ROBOT_W = 1071;
const CANVAS_W = 2111;
const CANVAS_H = 3078;
const ROBOT_X = (CANVAS_W - ROBOT_W) / 2;

// Joint pixel positions, measured against the render itself (verified by
// drawing them back onto the image), then shifted into canvas space.
// The robot faces the viewer, so its own left side appears on the right.
const RAW_POS: Record<string, [number, number]> = {
  "Right Shoulder": [351, 530],
  "Left Shoulder": [897, 525],
  "Right Elbow": [225, 1089],
  "Left Elbow": [968, 1056],
  "Right Wrist": [141, 1499],
  "Left Wrist": [897, 1537],
  Waist: [594, 1256],
  "Right Hip": [436, 1404],
  "Left Hip": [743, 1404],
  "Right Knee": [474, 2165],
  "Left Knee": [799, 2088],
  "Right Ankle": [430, 2729],
  "Left Ankle": [846, 2716],
};
const POS: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(RAW_POS).map(([k, [x, y]]) => [k, { x: x + ROBOT_X, y }])
);

// Visual-left column carries the robot's anatomically RIGHT joints (mirroring).
const LEFT_COL = ["Right Shoulder", "Right Elbow", "Right Wrist", "Right Hip", "Right Knee", "Right Ankle"];
const RIGHT_COL = ["Left Shoulder", "Left Elbow", "Left Wrist", "Left Hip", "Left Knee", "Left Ankle"];

const ROW_Y = [400, 870, 1330, 1800, 2270, 2740];
const LABEL_PAD = 40;
const LEAD_IN = 470;

interface Reading {
  group: (typeof JOINT_GROUPS)[number];
  temp: number | null;
  hasError: boolean;
}

interface Props {
  jointTemps: number[] | null; // 29 entries, or null when the robot is offline
  jointErrors: number[] | null; // 29 entries, motorstate codes
}

export function BodyMap({ jointTemps, jointErrors }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const scope = useRef<HTMLDivElement>(null);
  const hasData = !!jointTemps;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline()
          .from(".g1-render", { opacity: 0, scale: 0.96, duration: 0.8, ease: "power3.out" })
          .from(".joint-lead", { opacity: 0, duration: 0.45, stagger: 0.04, ease: "power1.out" }, "-=0.45")
          .from(".joint-mark", { opacity: 0, duration: 0.4, stagger: 0.04, ease: "power2.out" }, "-=0.35");

        // Slow, randomised halo breathing so the panel reads as live telemetry
        // rather than a static diagram — without pulling focus off the numbers.
        if (hasData) {
          gsap.to(".joint-halo", {
            opacity: "-=0.14",
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            stagger: { each: 0.2, from: "random" },
          });
        }
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([".g1-render", ".joint-lead", ".joint-mark"], { opacity: 1, scale: 1 });
      });

      return () => mm.revert();
    },
    { scope, dependencies: [hasData] }
  );

  const readingFor = (label: string): Reading => {
    const group = JOINT_GROUPS.find((g) => g.label === label)!;
    if (!jointTemps) return { group, temp: null, hasError: false };
    let worst = -Infinity;
    let hasError = false;
    for (const i of group.indices) {
      const t = jointTemps[i];
      if (typeof t === "number" && t > worst) worst = t;
      if (jointErrors && jointErrors[i]) hasError = true;
    }
    return { group, temp: worst === -Infinity ? null : worst, hasError };
  };

  const waist = readingFor("Waist");
  const leftRows = LEFT_COL.map(readingFor);
  const rightRows = RIGHT_COL.map(readingFor);
  const activeReading = active ? readingFor(active) : null;

  const bind = (label: string) => ({
    onMouseEnter: () => setActive(label),
    onMouseLeave: () => setActive(null),
    onClick: () => setActive(active === label ? null : label),
    style: { cursor: "pointer" as const },
  });

  const renderCallout = (r: Reading, i: number, side: "left" | "right") => {
    const y = ROW_Y[i];
    const p = POS[r.group.label];
    const startX = side === "left" ? LEAD_IN : CANVAS_W - LEAD_IN;
    const textX = side === "left" ? LABEL_PAD : CANVAS_W - LABEL_PAD;
    const isActive = active === r.group.label;
    const color = severityColor(r.temp);
    return (
      <g key={r.group.label} className="joint-lead" {...bind(r.group.label)}>
        <line
          x1={startX}
          y1={y}
          x2={p.x}
          y2={p.y}
          stroke={isActive ? color : "#8595ad"}
          strokeWidth={isActive ? 5 : 2.5}
          opacity={isActive ? 0.95 : 0.4}
          style={{ transition: "opacity 160ms ease, stroke-width 160ms ease" }}
        />
        <circle cx={startX} cy={y} r={9} fill={color} opacity={isActive ? 1 : 0.75} />
        <text
          x={textX}
          y={y + 26}
          textAnchor={side === "left" ? "start" : "end"}
          fontSize="76"
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontWeight={700}
          fill={color}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {r.temp === null ? "—" : `${r.temp.toFixed(0)}°C`}
        </text>
        <text
          x={textX}
          y={y - 30}
          textAnchor={side === "left" ? "start" : "end"}
          fontSize="44"
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontWeight={500}
          fill="#8595ad"
          letterSpacing="2"
        >
          {r.group.label.replace(/^(Left|Right) /, "").toUpperCase()}
        </text>
      </g>
    );
  };

  const renderMarker = (r: Reading) => {
    const p = POS[r.group.label];
    const isActive = active === r.group.label;
    const color = severityColor(r.temp);
    const rad = r.group.label === "Waist" ? 26 : isActive ? 44 : 34;
    return (
      <g key={`m-${r.group.label}`} className="joint-mark" {...bind(r.group.label)}>
        {r.hasError && (
          <circle cx={p.x} cy={p.y} r={rad + 26} fill="none" stroke={CRIT} strokeWidth="7">
            <animate attributeName="r" values={`${rad + 16};${rad + 44};${rad + 16}`} dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.05;0.9" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
        <circle className="joint-halo" cx={p.x} cy={p.y} r={rad + 20} fill={color} opacity={r.temp === null ? 0.07 : 0.24} />
        <circle
          cx={p.x}
          cy={p.y}
          r={rad}
          fill="none"
          stroke={color}
          strokeWidth={isActive ? 9 : 6}
          opacity={r.temp === null ? 0.4 : 0.95}
          style={{ transition: "r 140ms ease, stroke-width 140ms ease" }}
        />
      </g>
    );
  };

  return (
    <div ref={scope} className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-[460px] mx-auto" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
        <div
          className="absolute inset-y-0"
          style={{ left: `${(ROBOT_X / CANVAS_W) * 100}%`, width: `${(ROBOT_W / CANVAS_W) * 100}%` }}
        >
          <Image
            src="/robot/g1-unitree.webp"
            alt="Unitree G1 joint temperature map"
            fill
            sizes="240px"
            unoptimized
            className="g1-render object-contain"
          />
        </div>

        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0 w-full h-full" aria-label="Joint temperatures">
          {leftRows.map((r, i) => renderCallout(r, i, "left"))}
          {rightRows.map((r, i) => renderCallout(r, i, "right"))}
          {[...leftRows, ...rightRows, waist].map(renderMarker)}
        </svg>
      </div>

      <div className="flex items-center gap-5 text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: "#8595ad" }}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: OK }} />{"<"}{JOINT_TEMP_WARN_C}°C</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: WARN }} />{JOINT_TEMP_WARN_C}–{JOINT_TEMP_CRIT_C}°C</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: CRIT }} />{">"}{JOINT_TEMP_CRIT_C}°C</span>
      </div>

      {activeReading ? (
        <div
          className="w-full max-w-xs p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.11)" }}
        >
          <h4 className="font-bold text-sm mb-2.5 text-center" style={{ color: "#e8ecf5" }}>
            {activeReading.group.label}
          </h4>
          <div className="flex flex-col gap-1.5">
            {activeReading.group.indices.map((i) => {
              const t = jointTemps?.[i] ?? null;
              const err = jointErrors?.[i] ?? 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <span style={{ color: "#8595ad" }}>{JOINT_NAMES[i]}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {err !== 0 && <span className="font-bold" style={{ color: CRIT }}>ERR {err}</span>}
                    <span style={{ color: severityColor(t) }}>{t === null ? "—" : `${t.toFixed(1)}°C`}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs font-mono text-center" style={{ color: "#8595ad" }}>
          {jointTemps ? "Hover or tap a joint for its exact reading." : "No joint data — robot offline."}
        </p>
      )}
    </div>
  );
}
