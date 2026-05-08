"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.loginUser({ username, password });
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        const data = response.data as { access_token?: string };
        if (data.access_token) {
          api.setToken(data.access_token);
          router.push("/dashboard");
        } else {
          setError("Invalid response from server.");
        }
      }
    } catch (err) {
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden text-foreground bg-background selection:bg-primary/30">
      {/* Left Hero Panel */}
      <div className="hidden lg:flex w-1/2 h-full relative overflow-hidden flex-col justify-between border-r border-border/50 bg-gradient-to-br from-background via-background to-accent/30 p-12">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.15, 0.3, 0.15],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-primary/30 blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[100px]"
          />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <span className="text-primary-foreground font-bold text-xl">G1</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">RAG System</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Knowledge at<br />your command.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Empower your G1 robot with instant, intelligent retrieval of manuals and documents. Your AI-driven neural knowledge base awaits.
          </motion.p>
        </div>

        <div className="relative z-10 text-sm font-medium text-muted-foreground">
          &copy; {new Date().getFullYear()} G1 Intelligence. All rights reserved.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex items-center justify-center p-6 sm:p-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8 my-auto"
        >
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25">
                <span className="text-primary-foreground font-bold text-2xl">G1</span>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-3 text-muted-foreground text-lg">Enter your credentials to access the dashboard</p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl bg-destructive/10 border border-destructive/20 p-4"
              >
                <p className="text-sm font-medium text-destructive">{error}</p>
              </motion.div>
            )}
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-semibold text-foreground">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="flex h-12 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-foreground">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="flex h-12 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <input
                type="checkbox"
                id="remember"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-transparent cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium text-muted-foreground cursor-pointer"
              >
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-70 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 h-12 w-full active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Authenticating...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-4">
            Contact your administrator to get access.
          </p>
        </motion.div>
      </div>
    </div>
  );
}