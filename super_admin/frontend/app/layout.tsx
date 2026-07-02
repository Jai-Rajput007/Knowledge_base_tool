import './globals.css';
import { SuperAdminNavbar } from '@/components/super-admin/SuperAdminNavbar';

import { ThemeProvider } from '@/components/theme-provider';

export const metadata = {
  title: 'System Core | Super Admin',
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Temporary mock session until Python Auth is wired up
  const session = {
    name: "Super Admin",
    role: "super_admin"
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen bg-background text-foreground selection:bg-purple-500/30 antialiased">
        <ThemeProvider>
          {/* Resizable Animated Navbar */}
          <SuperAdminNavbar session={session} />

          <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 pt-24">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
