"use client";

import React, { useRef } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import {
  FiBatteryCharging, FiCpu, FiThermometer, FiActivity, FiHardDrive,
  FiClock, FiZap, FiWifi, FiCompass, FiAlertTriangle,
} from "react-icons/fi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTelemetry } from "./hooks";
import { BodyMap } from "./BodyMap";
import { JOINT_TEMP_WARN_C, JOINT_TEMP_CRIT_C } from "./types";

gsap.registerPlugin(useGSAP);

function tempColor(c: number | null | undefined): string {
  if (c == null) return "text-muted-foreground";
  if (c >= JOINT_TEMP_CRIT_C) return "text-red-500";
  if (c >= JOINT_TEMP_WARN_C) return "text-amber-500";
  return "text-emerald-500";
}

function StatTile({ icon: Icon, label, value, unit, tone }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon size={14} />
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <span className={`text-xl font-mono ${tone || ""}`}>
        {value} {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

function Panel({ title, icon: Icon, offline, children }: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  offline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 border border-border bg-card/20 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <Icon className={offline ? "text-muted-foreground" : "text-primary"} size={20} />
        <h3 className="font-bold text-lg uppercase tracking-wide">{title}</h3>
        {offline && (
          <span className="ml-auto text-xs bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            No Data
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function HealthStatsModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { telemetry, isOffline } = useTelemetry(5000);

  useGSAP(() => {
    gsap.fromTo(
      ".stat-card",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
  }, { scope: containerRef, dependencies: [telemetry?.timestamp] });

  const thor = telemetry?.thor;
  const robotBlock = telemetry?.robot;
  const robotData = robotBlock?.data;
  const robotAvailable = !!robotBlock?.available && !isOffline;
  const robotHonest = robotAvailable && !robotBlock?.stale; // fresh, trustworthy G1 data

  const battery = robotHonest ? robotData?.battery : null;
  const motion = robotHonest ? robotData?.robot : null;
  const imu = robotHonest ? robotData?.imu : null;
  const jointTemps = robotHonest ? robotData?.joints.temp_c ?? null : null;
  const jointErrors = robotHonest ? robotData?.joints.motorstate ?? null : null;

  const cellSpread = battery ? battery.cell_vol_max_mv - battery.cell_vol_min_mv : null;
  const anyMotorError = jointErrors?.some((e) => e !== 0) ?? false;

  const headline = [
    {
      label: "Thor CPU",
      value: thor && !isOffline ? `${thor.cpu_percent?.toFixed(0)}%` : "--",
      icon: FiCpu,
      tone: "text-blue-500",
    },
    {
      label: "G1 Battery",
      value: battery ? `${battery.soc}%` : "--",
      icon: FiBatteryCharging,
      tone: battery && battery.soc < 30 ? "text-amber-500" : "text-emerald-500",
    },
    {
      label: "Max Motor Temp",
      value: robotData ? `${robotData.max_motor_temp_c.toFixed(1)}°C` : "--",
      icon: FiActivity,
      tone: tempColor(robotData?.max_motor_temp_c),
    },
    {
      label: "Power Mode",
      value: thor?.power_mode || "--",
      icon: FiZap,
      tone: "text-purple-500",
    },
  ];

  return (
    <FeatureGate featureKey="healthStats">
      <div ref={containerRef} className="space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {headline.map((s) => (
            <div key={s.label} className="stat-card p-6 border border-border bg-card/30 rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-lg bg-background text-muted-foreground">
                  <s.icon size={24} />
                </div>
              </div>
              <h3 className={`text-3xl font-bold tracking-tighter mb-1 ${s.tone}`}>{s.value}</h3>
              <p className="text-xs font-mono text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Thor */}
        <Panel title="Jetson AGX Thor" icon={FiCpu} offline={isOffline || !thor?.reachable}>
          {thor ? (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatTile icon={FiClock} label="Uptime" value={`${thor.uptime_hrs ?? "--"}`} unit="HRS" />
                <StatTile icon={FiHardDrive} label="Disk Free" value={`${thor.disk_free_gb ?? "--"}`} unit="GB" />
                <StatTile icon={FiActivity} label="RAM Used" value={`${thor.memory_percent?.toFixed(0) ?? "--"}`} unit="%" />
                <StatTile icon={FiZap} label="GPU Util" value={`${thor.gpu_util_pct ?? "--"}`} unit="%" />
                <StatTile icon={FiWifi} label="Net Sent" value={`${thor.net_sent_mb ?? "--"}`} unit="MB" />
                <StatTile icon={FiWifi} label="Net Recv" value={`${thor.net_recv_mb ?? "--"}`} unit="MB" />
                <StatTile
                  icon={FiThermometer}
                  label="Junction Temp"
                  value={`${thor.thermal_c?.tj?.toFixed(1) ?? "--"}`}
                  unit="°C"
                  tone={tempColor(thor.thermal_c?.tj)}
                />
                <StatTile
                  icon={FiZap}
                  label="Total Power"
                  value={`${thor.power_mw?.VIN ? (thor.power_mw.VIN.inst_mw / 1000).toFixed(1) : "--"}`}
                  unit="W"
                />
              </div>

              {/* Per-core CPU */}
              {thor.cpu_cores?.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-3">
                    CPU Cores ({thor.cpu_cores.length})
                  </span>
                  <div className="grid grid-cols-7 sm:grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
                    {thor.cpu_cores.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-1" title={`Core ${i}: ${c.load_pct}% @ ${c.clock_mhz}MHz`}>
                        <div className="w-full h-16 bg-background rounded relative overflow-hidden border border-border">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-primary/70"
                            style={{ height: `${Math.max(2, c.load_pct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground">{i}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thermal zones */}
              {thor.thermal_c && Object.keys(thor.thermal_c).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-3">
                    Thermal Zones
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(thor.thermal_c).map(([zone, temp]) => (
                      <div key={zone} className="px-3 py-2 rounded-lg border border-border bg-background/60 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{zone}</span>
                        <span className={`text-sm font-mono font-bold ${tempColor(temp)}`}>{temp.toFixed(1)}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Power rails */}
              {thor.power_mw && Object.keys(thor.power_mw).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-3">
                    Power Rails
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(thor.power_mw).map(([rail, w]) => (
                      <div key={rail} className="px-3 py-2 rounded-lg border border-border bg-background/60 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{rail}</span>
                        <span className="text-sm font-mono">{(w.inst_mw / 1000).toFixed(2)} W</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Loading...</span>
            </div>
          )}
        </Panel>

        {/* G1 Robot */}
        <Panel title="G1 Robot" icon={FiActivity} offline={!robotHonest}>
          {robotHonest && robotData ? (
            <div className="flex flex-col gap-8">
              {robotBlock?.stale && (
                <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg">
                  <FiAlertTriangle size={14} />
                  Last update {robotBlock.last_seen_s_ago}s ago — may be stale
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatTile icon={FiBatteryCharging} label="State of Health" value={`${battery?.soh}`} unit="%" />
                <StatTile icon={FiActivity} label="Charge Cycles" value={`${battery?.cycle}`} />
                <StatTile icon={FiZap} label="Battery Voltage" value={`${((battery?.voltage_mv ?? 0) / 1000).toFixed(1)}`} unit="V" />
                <StatTile
                  icon={FiZap}
                  label={((battery?.current_ma ?? 0) < 0) ? "Discharging" : "Charging"}
                  value={`${Math.abs((battery?.current_ma ?? 0) / 1000).toFixed(2)}`}
                  unit="A"
                />
                <StatTile
                  icon={FiBatteryCharging}
                  label="Cell Spread"
                  value={`${cellSpread ?? "--"}`}
                  unit="mV"
                  tone={cellSpread && cellSpread > 100 ? "text-amber-500" : undefined}
                />
                <StatTile icon={FiCompass} label="Roll / Pitch / Yaw" value={`${imu?.roll.toFixed(2)} / ${imu?.pitch.toFixed(2)} / ${imu?.yaw.toFixed(2)}`} />
                <StatTile icon={FiActivity} label="FSM Mode" value={`${motion?.fsm_mode}`} />
                <StatTile icon={FiActivity} label="Mode Machine" value={`${motion?.mode_machine}`} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Joint Temperatures
                  </span>
                  {anyMotorError && (
                    <span className="text-[10px] uppercase tracking-widest font-bold text-red-500 flex items-center gap-1">
                      <FiAlertTriangle size={11} /> Motor fault detected
                    </span>
                  )}
                </div>
                <BodyMap jointTemps={jointTemps} jointErrors={jointErrors} />
              </div>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center gap-2">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {isOffline ? "Backend unreachable" : "No data from robot — powered off or robot_agent not running"}
              </span>
            </div>
          )}
        </Panel>

      </div>
    </FeatureGate>
  );
}
