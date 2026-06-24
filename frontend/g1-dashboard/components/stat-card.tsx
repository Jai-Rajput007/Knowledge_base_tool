export function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="p-4 rounded-xl border border-border bg-bg-secondary">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm text-text-muted">{title}</p>
        <span className="text-text-muted">{icon}</span>
      </div>
      <h3 className="text-2xl font-semibold text-text-primary">{value}</h3>
      {trend && <p className="text-xs text-accent-blue mt-1">{trend}</p>}
    </div>
  );
}
