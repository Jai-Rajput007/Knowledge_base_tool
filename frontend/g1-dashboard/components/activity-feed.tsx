export function ActivityFeed({ activities = [] }: any) {
  return (
    <div className="space-y-4">
      {activities.map((act: any, i: number) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
            {act.icon}
          </div>
          <div>
            <p className="text-sm text-text-primary">{act.message}</p>
            <p className="text-xs text-text-muted">{act.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
