"use client";

import React, { useRef, useState, useEffect } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiBatteryCharging, FiCpu, FiWifi, FiThermometer, FiActivity } from "react-icons/fi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { api, API_BASE_URL } from "@/lib/api";

gsap.registerPlugin(useGSAP);

export function HealthStatsModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const token = api.getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(`${API_BASE_URL}/health/telemetry`, { headers });
        if (!res.ok) throw new Error("Failed to fetch telemetry");
        
        const data = await res.json();
        setTelemetry(data);
        setIsOffline(false);
      } catch (err) {
        setIsOffline(true);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  useGSAP(() => {
    // Animate the stat cards in
    gsap.fromTo(
      ".stat-card",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }
    );

    // Animate the live telemetry bars
    gsap.to(".telemetry-bar", {
      height: "20%",
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: {
        each: 0.1,
        yoyo: true,
        repeat: -1
      }
    });
  }, { scope: containerRef });

  const stats = telemetry && !isOffline ? [
    { label: "AGX Core Temp", value: `${telemetry.agx_orin.temp_c}°C`, status: "normal", icon: FiThermometer, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "G1 Battery", value: `${telemetry.g1_chassis.battery_soc}%`, status: telemetry.g1_chassis.battery_soc < 30 ? "warning" : "good", icon: FiBatteryCharging, color: telemetry.g1_chassis.battery_soc < 30 ? "text-amber-500" : "text-green-500", bg: telemetry.g1_chassis.battery_soc < 30 ? "bg-amber-500/10" : "bg-green-500/10" },
    { label: "AGX GPU Load", value: `${telemetry.agx_orin.gpu_usage_pct}%`, status: "active", icon: FiCpu, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Motor Temp Max", value: `${telemetry.g1_chassis.max_motor_temp}°C`, status: telemetry.g1_chassis.status, icon: FiActivity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ] : [
    { label: "AGX Core Temp", value: "--°C", status: "offline", icon: FiThermometer, color: "text-muted-foreground", bg: "bg-muted/10" },
    { label: "G1 Battery", value: "--%", status: "offline", icon: FiBatteryCharging, color: "text-muted-foreground", bg: "bg-muted/10" },
    { label: "AGX GPU Load", value: "--%", status: "offline", icon: FiCpu, color: "text-muted-foreground", bg: "bg-muted/10" },
    { label: "Motor Temp Max", value: "--°C", status: "offline", icon: FiActivity, color: "text-muted-foreground", bg: "bg-muted/10" },
  ];

  return (
    <FeatureGate featureKey="healthStats">
      <div ref={containerRef} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="stat-card p-6 border border-border bg-card/30 rounded-xl relative overflow-hidden group hover:bg-card/60 transition-colors"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${stat.bg.replace('/10', '')}`} />
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded border border-border ${stat.status === 'offline' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground bg-background'}`}>
                  {stat.status}
                </span>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-3xl font-bold tracking-tighter mb-1">{stat.value}</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 border border-border bg-card/20 rounded-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <FiActivity className={isOffline ? "text-muted-foreground" : "text-primary"} size={20} />
            <h3 className="font-bold text-lg uppercase tracking-wide">System Diagnostics</h3>
            {isOffline && (
              <span className="ml-auto text-xs bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Connection Lost
              </span>
            )}
          </div>
          
          <div className={`h-48 flex items-center justify-center border border-dashed rounded-lg transition-colors ${isOffline ? 'border-red-500/30 bg-red-500/5' : 'border-border/50 bg-background/50'}`}>
            <div className="flex flex-col items-center gap-3">
              <div className={`flex items-end gap-1 h-12 ${isOffline ? 'opacity-20' : 'opacity-50'}`}>
                {[40, 70, 45, 90, 65, 30, 80, 50, 60, 40, 75, 55, 85].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: isOffline ? '10%' : `${h}%` }}
                    className={`telemetry-bar w-2 rounded-t-sm ${isOffline ? 'bg-muted-foreground' : 'bg-primary/40'}`}
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {isOffline ? "Awaiting Telemetry Data..." : "Live Telemetry Active"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
