import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import type { NavItem } from '@/components/sidebar';

const superAdminNav: NavItem[] = [
  { name: 'Dashboard', href: '/super-admin', icon: 'dashboard' },
  { name: 'All Tenants', href: '/super-admin/tenants', icon: 'tenants' },
  { name: 'All Users', href: '/super-admin/users', icon: 'users' },
  { name: 'Analytics', href: '/super-admin/analytics', icon: 'analytics' },
  { name: 'Persona Library', href: '/super-admin/personas', icon: 'personas' },
  { name: 'System Settings', href: '/super-admin/settings', icon: 'settings' },
  { name: 'Audit Logs', href: '/super-admin/audit', icon: 'audit' },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // No valid session — redirect to sign-in
  if (!session) redirect('/sign-in');

  // Only super_admin can access this layout
  if (session.role !== 'super_admin') redirect('/client-dashboard');

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar
        title="G1 Robot Platform"
        subtitle="Super Admin"
        navItems={superAdminNav}
      />
      <div className="flex-1 ml-[260px] flex flex-col">
        <Header
          title="Platform Overview"
          userName={session.name}
          userRole={session.role}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
