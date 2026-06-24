export default function GestureSettingsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Gesture Settings
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Configure system parameters and operational protocols
        </p>
      </div>

      

      
      <section id="custom" className="min-h-[50vh] border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[01]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">custom</h2>
        </div>
        
        <div className="border border-border bg-card/50 p-6">
          <p className="text-xs font-mono text-muted-foreground uppercase mb-6">
            // active parameters
          </p>
          <div className="h-48 border border-dashed border-border/50 flex items-center justify-center">
            <span className="text-muted-foreground font-mono text-[10px]">NO MODULES LOADED</span>
          </div>
        </div>
      </section>
      
      <section id="add" className="min-h-[50vh] border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[02]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">add</h2>
        </div>
        
        <div className="border border-border bg-card/50 p-6">
          <p className="text-xs font-mono text-muted-foreground uppercase mb-6">
            // active parameters
          </p>
          <div className="h-48 border border-dashed border-border/50 flex items-center justify-center">
            <span className="text-muted-foreground font-mono text-[10px]">NO MODULES LOADED</span>
          </div>
        </div>
      </section>
      
    </div>
  );
}