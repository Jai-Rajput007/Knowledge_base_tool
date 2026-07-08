import { StatCard } from "@/app/components/stat-card";
import { ActivityFeed } from "@/app/components/activity-feed";
import { getIcon } from "@/app/components/icons";

const quickAccessCards = [
  {
    title: 'Manage Personas',
    description: 'Configure AI personalities and behaviors for your robots',
    icon: 'personas',
    href: '/persona',
    gradient: 'from-accent-blue/20 to-accent-purple/20',
  },
  {
    title: 'Robot Inventory',
    description: 'View, manage, and monitor all your deployed robots',
    icon: 'robots',
    href: '/inventory',
    gradient: 'from-accent-purple/20 to-accent-cyan/20',
  },
  {
    title: 'Preview Simulator',
    description: 'Test conversations and interactions before deployment',
    icon: 'simulator',
    href: '/chat',
    gradient: 'from-accent-cyan/20 to-accent-blue/20',
  },
  {
    title: 'Templates',
    description: 'Browse and apply pre-built persona and workflow templates',
    icon: 'templates',
    href: '/persona#templates',
    gradient: 'from-accent-blue/20 to-success/20',
  },
  {
    title: 'Facial Recognition',
    description: 'Add users to the facial recognition system (FRS)',
    icon: 'robots',
    href: '/employees',
    gradient: 'from-accent-purple/20 to-accent-blue/20',
  },
];

const activityItems = [
  { id: '1', message: 'Robot G1-047 came online in Lobby A', time: '5 minutes ago', type: 'success' as const },
  { id: '2', message: 'Persona "Greeter" updated successfully', time: '30 minutes ago', type: 'info' as const },
  { id: '3', message: 'Conversation spike detected — 200+ in 1 hour', time: '2 hours ago', type: 'warning' as const },
  { id: '4', message: 'Team member sarah@g1universe.com accepted invite', time: '4 hours ago', type: 'success' as const },
  { id: '5', message: 'Template "Customer Service v3" applied to 5 robots', time: '6 hours ago', type: 'info' as const },
];

export default function ClientDashboardPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-6xl mx-auto px-4 pt-32 pb-32 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome to{' '}
          <span className="gradient-text">G1 Universe</span>{' '}
          Dashboard
        </h1>
        <p className="text-sm text-text-muted mt-1">{today}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Active Robots"
          value="47"
          change="+3 this week"
          changeType="positive"
          icon={getIcon('robots')}
        />
        <StatCard
          title="Configured Personas"
          value="23"
          change="+2 new"
          changeType="positive"
          icon={getIcon('personas')}
        />
        <StatCard
          title="Conversations Today"
          value="1,842"
          change="+12% vs yesterday"
          changeType="positive"
          icon={getIcon('activity')}
        />
        <StatCard
          title="System Status"
          value="Operational"
          change="All systems go"
          changeType="neutral"
          icon={getIcon('health')}
        />
      </div>

      {/* Quick Access + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Access Cards */}
        <div className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Quick Access
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickAccessCards.map((card) => (
              <a
                key={card.title}
                href={card.href}
                className="group bg-bg-secondary rounded-xl border border-border p-6 hover:border-accent-blue/50 hover:-translate-y-0.5 transition-all duration-300 block"
              >
                <div
                  className={`w-11 h-11 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center text-accent-blue mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  {getIcon(card.icon, "w-5 h-5")}
                </div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">
                  {card.title}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {card.description}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="xl:col-span-1">
          <ActivityFeed title="Recent Activity" items={activityItems} />
        </div>
      </div>
    </div>
  );
}
