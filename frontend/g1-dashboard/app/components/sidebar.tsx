'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getIcon } from '@/components/icons';

export interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
}

export function Sidebar({ title, subtitle, navItems }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-bg-secondary border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shrink-0">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <circle cx="9" cy="10" r="1.5" fill="white" stroke="none" />
              <circle cx="15" cy="10" r="1.5" fill="white" stroke="none" />
              <path d="M9 15h6" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text-primary truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-muted truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                }`}
              >
                {getIcon(item.icon)}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 text-xs text-text-muted">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          System Online
        </div>
      </div>
    </aside>
  );
}
