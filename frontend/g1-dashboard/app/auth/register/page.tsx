"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await api.registerUser({ username, email, password });
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 1500);
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
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
              rotate: [0, -90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary/30 blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[100px]"
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
            Create your <br />knowledge hub.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Upload, embed, and query vast amounts of documentation instantly. Build the brain for your G1 robot today.
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
          className="max-w-md w-full space-y-6 my-auto"
        >
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25">
                <span className="text-primary-foreground font-bold text-2xl">G1</span>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Sign Up</h2>
            <p className="mt-3 text-muted-foreground text-lg">Enter your details to create an account</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl bg-destructive/10 border border-destructive/20 p-4"
              >
                <p className="text-sm font-medium text-destructive">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl bg-green-500/10 border border-green-500/20 p-4"
              >
                <p className="text-sm font-medium text-green-500">Account created successfully! Redirecting...</p>
              </motion.div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-semibold text-foreground">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="flex h-11 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-foreground">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="flex h-11 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-semibold text-foreground">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="flex h-11 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground">Confirm</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="flex h-11 w-full rounded-xl border border-input bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <input
                type="checkbox"
                id="terms"
                required
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background bg-transparent cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm font-medium text-muted-foreground cursor-pointer">
                I agree to the <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">Terms</Link> & <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">Privacy</Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex mt-2 items-center justify-center rounded-xl text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-70 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 h-12 w-full active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}