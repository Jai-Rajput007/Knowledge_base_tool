'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  userName?: string;
  userRole?: string;
}

export function Header({ title, userName, userRole }: HeaderProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Force a hard redirect to bypass Next.js soft navigation cache
      window.location.href = '/sign-in';
    } catch {
      setSigningOut(false);
    }
  }

  const roleBadgeStyles: Record<string, string> = {
    super_admin: 'bg-accent-purple/10 text-accent-purple',
    client: 'bg-accent-blue/10 text-accent-blue',
    viewer: 'bg-accent-cyan/10 text-accent-cyan',
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    client: 'Client',
    viewer: 'Viewer',
  };

  return (
    <header className="h-16 bg-bg-secondary/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-8 sticky top-0 z-40">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <input
            id="global-search"
            type="text"
            placeholder="Search..."
            className="w-64 h-9 pl-9 pr-4 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 transition-colors"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        {/* Notifications */}
        <button
          id="notifications-btn"
          className="relative w-9 h-9 rounded-lg bg-bg-elevated border border-border flex items-center justify-center hover:border-border-hover transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue rounded-full text-[10px] flex items-center justify-center text-white font-semibold">
            3
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* User Info + Sign Out */}
        <div className="flex items-center gap-3">
          {userName && (
            <div className="text-right">
              <p className="text-sm font-medium text-text-primary leading-tight">{userName}</p>
              {userRole && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${roleBadgeStyles[userRole] || 'bg-bg-elevated text-text-muted'}`}>
                  {roleLabels[userRole] || userRole}
                </span>
              )}
            </div>
          )}

          {/* Avatar / Initial */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white text-xs font-bold">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="h-8 px-3 rounded-lg bg-bg-elevated border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-hover transition-all cursor-pointer disabled:opacity-50"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  );
}
