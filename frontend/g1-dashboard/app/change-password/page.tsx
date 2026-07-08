'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { api } = await import('@/lib/api');
      const res = await api.changePassword({ 
        current_password: oldPassword, 
        new_password: newPassword 
      });

      if (res.error) {
        setError(res.error || 'Failed to change password');
        setLoading(false);
        return;
      }

      // Sync Next.js PASETO cookie to remove requiresPasswordChange flag
      await fetch('/api/auth/change-password', {
        method: 'PUT',
      });

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent-blue/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-bg-secondary/80 backdrop-blur-xl rounded-2xl border border-border p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-1.5">
              Change Password
            </h1>
            <p className="text-sm text-text-muted">
              Please change your default password to securely access the dashboard.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-error/10 border border-error/20 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-error shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Old Password */}
            <div>
              <label htmlFor="oldPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="oldPassword"
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-4 pr-11 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showOldPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-4 pr-11 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-4 pr-11 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-all"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-accent-blue to-accent-purple text-white text-sm font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:ring-offset-2 focus:ring-offset-bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating...
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
