import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import type { NavItem } from '@/components/sidebar';

const clientNav: NavItem[] = [
  { name: 'Dashboard', href: '/client-dashboard', icon: 'dashboard' },
  { name: 'My Robots', href: '/client-dashboard/robots', icon: 'robots' },
  { name: 'Persona Management', href: '/client-dashboard/personas', icon: 'personas' },
  { name: 'Intelligence Settings', href: '/client-dashboard/intelligence', icon: 'intelligence' },
  { name: 'Templates Library', href: '/client-dashboard/templates', icon: 'templates' },
  { name: 'Team', href: '/client-dashboard/team', icon: 'team' },
  { name: 'Settings', href: '/client-dashboard/settings', icon: 'settings' },
];

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // No valid session — redirect to sign-in
  if (!session) redirect('/sign-in');

  // super_admin can also view client dashboard (for debugging/support)
  // client and viewer can access this dashboard
  // Viewer gets read-only access (enforced at component/API level)
  const allowedRoles = ['super_admin', 'client', 'viewer'];
  if (!allowedRoles.includes(session.role)) redirect('/sign-in');

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar
        title={session.tenantName || 'G1 Platform'}
        subtitle={session.role === 'viewer' ? 'Viewer Access' : 'Tenant Dashboard'}
        navItems={clientNav}
      />
      <div className="flex-1 ml-[260px] flex flex-col">
        <Header
          title="Robot Dashboard"
          userName={session.name}
          userRole={session.role}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
