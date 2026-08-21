"use client";

import React, { useState } from "react";
import { JOINT_GROUPS, JOINT_NAMES, JOINT_TEMP_WARN_C, JOINT_TEMP_CRIT_C } from "./types";

function severityColor(temp: number | null): string {
  if (temp === null) return "var(--muted-foreground, #71717a)";
  if (temp >= JOINT_TEMP_CRIT_C) return "#e0575d";
  if (temp >= JOINT_TEMP_WARN_C) return "#e0a83f";
  return "#3fb87e";
}

interface Props {
  jointTemps: number[] | null; // 29 entries, or null if no robot data
  jointErrors: number[] | null; // 29 entries, motorstate codes
}

export function BodyMap({ jointTemps, jointErrors }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const groupWorst = (indices: number[]) => {
    if (!jointTemps) return { temp: null as number | null, hasError: false };
    let worst = -Infinity;
    let hasError = false;
    for (const i of indices) {
      const t = jointTemps[i];
      if (typeof t === "number" && t > worst) worst = t;
      if (jointErrors && jointErrors[i]) hasError = true;
    }
    return { temp: worst === -Infinity ? null : worst, hasError };
  };

  const activeGroup = active !== null ? JOINT_GROUPS[active] : null;

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      <svg
        viewBox="0 0 200 400"
        className="w-full max-w-[220px] mx-auto sm:mx-0 flex-shrink-0"
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

        {JOINT_GROUPS.map((g, idx) => {
          const { temp, hasError } = groupWorst(g.indices);
          const color = severityColor(temp);
          const isActive = active === idx;
          return (
            <g
              key={g.label}
              onMouseEnter={() => setActive(idx)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(isActive ? null : idx)}
              style={{ cursor: "pointer" }}
            >
              {hasError && (
                <circle cx={g.x} cy={g.y} r="9" fill="none" stroke="#e0575d" strokeWidth="1.5">
                  <animate attributeName="r" values="7;11;7" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={g.x}
                cy={g.y}
                r={isActive ? 8 : 6}
                fill={color}
                opacity={temp === null ? 0.35 : 0.92}
                stroke={isActive ? "currentColor" : "none"}
                strokeWidth="1.5"
                className={isActive ? "text-foreground" : ""}
                style={{ transition: "r 120ms ease" }}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#3fb87e" }} />{'<'}{JOINT_TEMP_WARN_C}°C</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#e0a83f" }} />{JOINT_TEMP_WARN_C}–{JOINT_TEMP_CRIT_C}°C</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#e0575d" }} />{'>'}{JOINT_TEMP_CRIT_C}°C</span>
        </div>

        {activeGroup ? (
          <div className="p-4 rounded-lg border border-border bg-background/60">
            <h4 className="font-bold text-sm mb-2">{activeGroup.label}</h4>
            <div className="flex flex-col gap-1.5">
              {activeGroup.indices.map((i) => {
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
