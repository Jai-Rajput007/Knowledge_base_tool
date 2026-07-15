'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.access_token) {
        import('@/lib/api').then(({ api }) => {
          api.setToken(data.access_token);
        });
      }

      const redirect = data.redirectTo || searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden px-4">
      {/* Local Video Background */}
      <video 
        autoPlay 
        loop 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover -z-20"
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for better text readability and glassmorphism contrast */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] -z-10"></div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <svg
              width="24"
              height="24"
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
          <span className="text-xl font-bold text-white">G1 Robot Platform</span>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl shadow-black/40">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Sign In
            </h1>
            <p className="text-sm text-gray-300">
              Enter your credentials to continue
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
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-1.5">
                Username / Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@g1platform.com"
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-11 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
            {/* Additional Links below button */}
            <div className="flex justify-between items-center text-xs text-gray-300 pt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="rounded border-white/20 bg-white/10 text-white focus:ring-white/30" />
                <span>Remember Me</span>
              </label>
              <a href="#" className="hover:text-white transition-colors">Forgot Password?</a>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-medium">
          Secured with PASETO v4 encrypted tokens
        </p>
      </div>
    </div>
  );
}
