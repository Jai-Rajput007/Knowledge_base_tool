"use client";

import React, { useState } from "react";
import Image from "next/image";
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

// Pixel coordinates of each joint's glow ring on /public/robot/g1-glass.png
// (1052x1495, the official Unitree G1 glass/x-ray render — used under our
// Unitree reseller partnership). The robot faces the viewer, so its own
// left side appears on the image's right half — mirrored, same as looking
// at a person from the front.
const IMAGE_W = 1052;
const IMAGE_H = 1495;
const IMAGE_POS: Record<string, { x: number; y: number }> = {
  "Right Shoulder": { x: 284, y: 344 },
  "Left Shoulder": { x: 768, y: 344 },
  "Right Elbow": { x: 252, y: 628 },
  "Left Elbow": { x: 799, y: 628 },
  "Right Wrist": { x: 263, y: 882 },
  "Left Wrist": { x: 789, y: 882 },
  Waist: { x: 526, y: 748 },
  "Right Hip": { x: 400, y: 867 },
  "Left Hip": { x: 652, y: 867 },
  "Right Knee": { x: 400, y: 1136 },
  "Left Knee": { x: 652, y: 1136 },
  "Right Ankle": { x: 368, y: 1390 },
  "Left Ankle": { x: 684, y: 1390 },
};

// Visual-left column (image x < center) holds the robot's anatomically
// RIGHT joints, and vice versa — same mirroring as IMAGE_POS above.
const VISUAL_LEFT_LABELS = ["Right Shoulder", "Right Elbow", "Right Wrist", "Right Hip", "Right Knee", "Right Ankle"];
const VISUAL_RIGHT_LABELS = ["Left Shoulder", "Left Elbow", "Left Wrist", "Left Hip", "Left Knee", "Left Ankle"];

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
  const leftRows = VISUAL_LEFT_LABELS.map(readingFor);
  const rightRows = VISUAL_RIGHT_LABELS.map(readingFor);
  const allLimbRows = [...leftRows, ...rightRows];

  const rowY = (i: number) => 140 + i * 250; // 6 evenly spaced label rows, 140..1390

  const activeReading = active ? readingFor(active) : null;

  const renderLabel = (r: Reading, i: number, side: "left" | "right") => {
    const y = rowY(i);
    const pos = IMAGE_POS[r.group.label];
    const lineStartX = side === "left" ? 190 : IMAGE_W - 190;
    const labelX = side === "left" ? 20 : IMAGE_W - 20;
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
          x2={pos.x}
          y2={pos.y}
          stroke={isActive ? color : "rgba(148,163,184,0.55)"}
          strokeWidth={isActive ? 3 : 1.5}
          opacity={isActive ? 0.95 : 0.7}
        />
        <circle cx={lineStartX} cy={y} r="4" fill={color} />
        <text
          x={labelX}
          y={y + 9}
          textAnchor={anchor}
          fontSize="30"
          fontFamily="var(--font-mono)"
          fontWeight={isActive ? 700 : 600}
          fill={color}
          style={{ paintOrder: "stroke", stroke: "#0b0f1a", strokeWidth: 5 }}
        >
          {r.temp === null ? "—" : `${r.temp.toFixed(0)}°C`}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="relative w-full max-w-[300px] mx-auto" style={{ aspectRatio: `${IMAGE_W} / ${IMAGE_H}` }}>
        <Image
          src="/robot/g1-glass.png"
          alt="Unitree G1 joint temperature map"
          fill
          sizes="300px"
          className="object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.15)]"
          priority={false}
        />

        <svg
          viewBox={`0 0 ${IMAGE_W} ${IMAGE_H}`}
          className="absolute inset-0 w-full h-full"
          role="img"
          aria-label="Joint temperature overlay"
        >
          {leftRows.map((r, i) => renderLabel(r, i, "left"))}
          {rightRows.map((r, i) => renderLabel(r, i, "right"))}

          {/* Glowing joint markers, color-coded by severity — the fault ring pulses red regardless of temp color */}
          {[...allLimbRows, waist].map((r) => {
            const isActive = active === r.group.label;
            const color = severityColor(r.temp);
            const pos = IMAGE_POS[r.group.label];
            const radius = r.group.label === "Waist" ? 14 : isActive ? 22 : 16;
            return (
              <g key={`marker-${r.group.label}`}>
                {r.hasError && (
                  <circle cx={pos.x} cy={pos.y} r={radius + 16} fill="none" stroke="var(--chart-5)" strokeWidth="4">
                    <animate attributeName="r" values={`${radius + 10};${radius + 26};${radius + 10}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={pos.x} cy={pos.y} r={radius + 10} fill={color} opacity={r.temp === null ? 0.08 : 0.22} />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={isActive ? 5 : 3.5}
                  opacity={r.temp === null ? 0.35 : 0.95}
                  style={{ transition: "r 120ms ease" }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider" style={{ color: "#8b95ab" }}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-2)" }} />{'<'}{JOINT_TEMP_WARN_C}°C</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-3)" }} />{JOINT_TEMP_WARN_C}–{JOINT_TEMP_CRIT_C}°C</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--chart-5)" }} />{'>'}{JOINT_TEMP_CRIT_C}°C</span>
      </div>

      {activeReading ? (
        <div className="w-full max-w-xs p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h4 className="font-bold text-sm mb-2 text-center" style={{ color: "#e8ecf5" }}>{activeReading.group.label}</h4>
          <div className="flex flex-col gap-1.5">
            {activeReading.group.indices.map((i) => {
              const t = jointTemps?.[i] ?? null;
              const err = jointErrors?.[i] ?? 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <span style={{ color: "#8b95ab" }}>{JOINT_NAMES[i]}</span>
                  <span className="flex items-center gap-2">
                    {err !== 0 && <span className="font-bold" style={{ color: "var(--chart-5)" }}>ERR {err}</span>}
                    <span style={{ color: severityColor(t) }}>{t === null ? "—" : `${t.toFixed(1)}°C`}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs font-mono text-center" style={{ color: "#8b95ab" }}>
          {jointTemps ? "Hover or tap a joint for its exact reading." : "No joint data — robot offline."}
        </p>
      )}
    </div>
  );
}
