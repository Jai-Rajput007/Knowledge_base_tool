import React from "react";

export function QuickReference() {
  return (
    <section className="border-t border-border pt-8">
      <p className="text-[10px] font-mono text-muted-foreground uppercase mb-4">// sample count guide</p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { samples: "0 recordings", recall: "60-75%", note: "TTS only, US accent" },
          { samples: "20-50 recordings", recall: "85-90%", note: "Good for most sites" },
          { samples: "100+ recordings", recall: "90-95%", note: "Multi-speaker, noisy envs" },
        ].map(r => (
          <div key={r.samples} className="border border-border/50 p-4">
            <p className="font-mono text-xs text-foreground uppercase">{r.samples}</p>
            <p className="font-mono text-lg font-bold text-primary mt-1">{r.recall}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">{r.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
