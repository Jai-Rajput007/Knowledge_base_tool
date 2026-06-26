import { StatCard } from '@/components/stat-card';
import { ActivityFeed } from '@/components/activity-feed';
import { getIcon } from '@/components/icons';

const recentTenants = [
  { name: 'G1 Universe', status: 'Active', robots: 47, plan: 'Enterprise', created: 'Jun 15, 2026' },
  { name: 'TechCorp AI', status: 'Active', robots: 32, plan: 'Pro', created: 'Jun 12, 2026' },
  { name: 'Stellar Dynamics', status: 'Active', robots: 28, plan: 'Enterprise', created: 'Jun 8, 2026' },
  { name: 'RoboVentures', status: 'Inactive', robots: 15, plan: 'Starter', created: 'May 30, 2026' },
  { name: 'Quantum Labs', status: 'Active', robots: 61, plan: 'Enterprise', created: 'May 22, 2026' },
];

const activityItems = [
  { id: '1', message: 'G1 Universe deployed 3 new G1 units', time: '2 minutes ago', type: 'success' as const },
  { id: '2', message: 'TechCorp AI updated persona "Receptionist v2"', time: '15 minutes ago', type: 'info' as const },
  { id: '3', message: 'System health check completed — all green', time: '1 hour ago', type: 'success' as const },
  { id: '4', message: 'New tenant registration: Quantum Labs', time: '3 hours ago', type: 'info' as const },
  { id: '5', message: 'RoboVentures subscription downgraded', time: '5 hours ago', type: 'warning' as const },
  { id: '6', message: 'Failed auth attempt from unknown IP', time: '8 hours ago', type: 'error' as const },
];

export default function SuperAdminPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Platform Overview —{' '}
          <span className="gradient-text">Super User</span>
        </h1>
        <p className="text-sm text-text-muted mt-1">{today}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Tenants"
          value="24"
          change="+12% from last month"
          changeType="positive"
          icon={getIcon('tenants')}
        />
        <StatCard
          title="Active Robots"
          value="1,284"
          change="+8% this week"
          changeType="positive"
          icon={getIcon('robots')}
        />
        <StatCard
          title="Personas Deployed"
          value="856"
          change="+15 new this month"
          changeType="positive"
          icon={getIcon('personas')}
        />
        <StatCard
          title="System Health"
          value="99.7%"
          change="Uptime — last 30 days"
          changeType="neutral"
          icon={getIcon('health')}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Tenants Table */}
        <div className="xl:col-span-2 bg-bg-secondary rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">
              Recent Tenants
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Tenant Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Robots
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((tenant) => (
                  <tr
                    key={tenant.name}
                    className="border-b border-border/30 hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center text-accent-purple">
                          {getIcon('tenants', 'w-3.5 h-3.5')}
                        </div>
                        <span className="text-sm font-medium text-text-primary">
                          {tenant.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tenant.status === 'Active'
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary font-mono">
                      {tenant.robots}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary">
                      {tenant.plan}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-muted">
                      {tenant.created}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="xl:col-span-1">
          <ActivityFeed title="Global Activity" items={activityItems} />
        </div>
      </div>
    </div>
  );
}
