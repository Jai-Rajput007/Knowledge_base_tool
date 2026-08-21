"use client";

import React, { useState } from "react";
import { JOINT_GROUPS, JOINT_NAMES, JOINT_TEMP_WARN_C, JOINT_TEMP_CRIT_C } from "./types";

function severityColor(temp: number | null): string {
  if (temp === null) return "var(--muted-foreground)";
  if (temp >= JOINT_TEMP_CRIT_C) return "var(--chart-5)";
  if (temp >= JOINT_TEMP_WARN_C) return "var(--chart-3)";
  return "var(--chart-2)";
}

interface Reading {
  group: (typeof JOINT_GROUPS)[number];
  temp: number | null;
  hasError: boolean;
}

// Fixed left/right/top layout so leader-line labels never overlap, independent
// of each marker's actual anatomical y — mirrors the always-visible
// per-part temperature callout layout from Unitree's own companion app,
// which is what prompted this redesign (see conversation).
const LEFT_LABELS = ["Left Shoulder", "Left Elbow", "Left Wrist", "Left Hip", "Left Knee", "Left Ankle"];
const RIGHT_LABELS = ["Right Shoulder", "Right Elbow", "Right Wrist", "Right Hip", "Right Knee", "Right Ankle"];

interface Props {
  jointTemps: number[] | null; // 29 entries, or null if no robot data
  jointErrors: number[] | null; // 29 entries, motorstate codes
}

export function BodyMap({ jointTemps, jointErrors }: Props) {
  const [active, setActive] = useState<string | null>(null);

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
  const leftRows = LEFT_LABELS.map(readingFor);
  const rightRows = RIGHT_LABELS.map(readingFor);

  const rowY = (i: number) => 84 + i * 52; // 6 evenly spaced rows, 84..344

  const activeReading = active ? readingFor(active) : null;

  const renderLabel = (r: Reading, i: number, side: "left" | "right") => {
    const y = rowY(i);
    const lineStartX = side === "left" ? 40 : 160;
    const labelX = side === "left" ? 6 : 194;
    const anchor = side === "left" ? "start" : "end";
    const isActive = active === r.group.label;
    const color = severityColor(r.temp);
    return (
      <g
        key={r.group.label}
        onMouseEnter={() => setActive(r.group.label)}
        onMouseLeave={() => setActive(null)}
        onClick={() => setActive(isActive ? null : r.group.label)}
        style={{ cursor: "pointer" }}
      >
        <line
          x1={lineStartX}
          y1={y}
          x2={r.group.x}
          y2={r.group.y}
          stroke={isActive ? color : "var(--border)"}
          strokeWidth={isActive ? 1.4 : 1}
          opacity={isActive ? 0.9 : 0.55}
        />
        <circle cx={lineStartX} cy={y} r="1.6" fill={color} />
        <text
          x={labelX}
          y={y + 3.5}
          textAnchor={anchor}
          fontSize="11"
          fontFamily="var(--font-mono)"
          fontWeight={isActive ? 700 : 500}
          fill={color}
        >
          {r.temp === null ? "—" : `${r.temp.toFixed(0)}°C`}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <svg
        viewBox="0 0 200 400"
        className="w-full max-w-[320px] mx-auto sm:mx-0 flex-shrink-0"
        role="img"
        aria-label="G1 joint temperature map"
      >
        {/* Schematic silhouette — behind the joint markers, low-contrast */}
        <g stroke="currentColor" className="text-border" strokeWidth="2" fill="none" opacity="0.55">
          <circle cx="100" cy="55" r="22" />
          <path d="M 78 90 Q 100 78 122 90 L 128 200 Q 100 212 72 200 Z" />
          <line x1="66" y1="108" x2="50" y2="150" />
          <line x1="50" y1="150" x2="40" y2="192" />
          <line x1="134" y1="108" x2="150" y2="150" />
          <line x1="150" y1="150" x2="160" y2="192" />
          <line x1="78" y1="205" x2="74" y2="278" />
          <line x1="74" y1="278" x2="70" y2="338" />
          <line x1="122" y1="205" x2="126" y2="278" />
          <line x1="126" y1="278" x2="130" y2="338" />
        </g>

        {/* Leader-line labels, always visible — left/right columns */}
        {leftRows.map((r, i) => renderLabel(r, i, "left"))}
        {rightRows.map((r, i) => renderLabel(r, i, "right"))}

        {/* Waist — single label above the head, no leader line needed */}
        <g
          onMouseEnter={() => setActive("Waist")}
          onMouseLeave={() => setActive(null)}
          onClick={() => setActive(active === "Waist" ? null : "Waist")}
          style={{ cursor: "pointer" }}
        >
          <circle cx={waist.group.x} cy={waist.group.y} r={active === "Waist" ? 6 : 4.5} fill={severityColor(waist.temp)} opacity={waist.temp === null ? 0.35 : 0.95} />
        </g>

        {/* Joint markers for left/right groups, with fault pulse */}
        {[...leftRows, ...rightRows].map((r) => {
          const isActive = active === r.group.label;
          const color = severityColor(r.temp);
          return (
            <g key={`marker-${r.group.label}`}>
              {r.hasError && (
                <circle cx={r.group.x} cy={r.group.y} r="9" fill="none" stroke="var(--chart-5)" strokeWidth="1.5">
                  <animate attributeName="r" values="7;11;7" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={r.group.x}
                cy={r.group.y}
                r={isActive ? 6 : 4.5}
                fill={color}
                opacity={r.temp === null ? 0.35 : 0.95}
                stroke={isActive ? "var(--foreground)" : "none"}
                strokeWidth="1.5"
                style={{ transition: "r 120ms ease" }}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-2)" }} />{'<'}{JOINT_TEMP_WARN_C}°C</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-3)" }} />{JOINT_TEMP_WARN_C}–{JOINT_TEMP_CRIT_C}°C</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-5)" }} />{'>'}{JOINT_TEMP_CRIT_C}°C</span>
        </div>

        {activeReading ? (
          <div className="p-4 rounded-lg border border-border bg-background/60">
            <h4 className="font-bold text-sm mb-2">{activeReading.group.label}</h4>
            <div className="flex flex-col gap-1.5">
              {activeReading.group.indices.map((i) => {
                const t = jointTemps?.[i] ?? null;
                const err = jointErrors?.[i] ?? 0;
                return (
                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{JOINT_NAMES[i]}</span>
                    <span className="flex items-center gap-2">
                      {err !== 0 && <span className="text-red-500 font-bold">ERR {err}</span>}
                      <span style={{ color: severityColor(t) }}>{t === null ? "—" : `${t.toFixed(1)}°C`}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">
            {jointTemps ? "Hover or tap a joint for its exact reading." : "No joint data — robot offline."}
          </p>
        )}
      </div>
    </div>
  );
}
