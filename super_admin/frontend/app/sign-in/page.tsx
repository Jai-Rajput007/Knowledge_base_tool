"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert } from "lucide-react";

export default function SuperAdminSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Session cookie is set server-side by the API route (HttpOnly)
        // No need to store anything in localStorage
        router.push("/");
      } else {
        setError(data.detail || "Invalid credentials");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center relative">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-foreground/5 border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="p-8 pb-6 text-center border-b border-foreground/10 relative">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.4)] mb-4">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">System Core Access</h1>
            <p className="text-sm text-foreground/50 mt-2 font-mono uppercase tracking-widest">
              Super Admin Authorization Required
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input 
                  type="email"
                  placeholder="super@admin.com"
                  className="w-full bg-background border border-foreground/10 pl-10 pr-3 py-3 text-sm text-foreground rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all placeholder:text-foreground/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Master Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input 
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-background border border-foreground/10 pl-10 pr-3 py-3 text-sm text-foreground rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all placeholder:text-foreground/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 px-4 py-3 rounded-lg bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(147,51,234,0.2)]"
            >
              {loading ? 'Authenticating...' : 'Authorize Login'}
            </button>
            
            <div className="text-center mt-4">
              <p className="text-xs text-foreground/30 font-mono">
                Master Fallback: master@g1universe.com / masterpassword123
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
