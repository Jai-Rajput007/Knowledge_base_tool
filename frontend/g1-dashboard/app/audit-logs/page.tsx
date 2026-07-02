"use client";

import { AuditingModule } from "@/app/features/auditing";

export default function AuditLogsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Audit Logs
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Complete action history and audit trail
        </p>
      </div>

      <AuditingModule />
    </div>
  );
}