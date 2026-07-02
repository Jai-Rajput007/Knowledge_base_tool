"use client";

import { HealthStatsModule } from "@/app/features/health-stats";

export default function RobotInventoryPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Health Stats
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Robot health monitoring and diagnostics
        </p>
      </div>

      <HealthStatsModule />
    </div>
  );
}