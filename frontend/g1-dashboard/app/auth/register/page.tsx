"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

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
        setTimeout(() => router.push("/sign-in"), 1500);
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              Sign Up
            </h1>
            <p className="text-sm text-gray-300">
              Create a new account
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-sm font-medium text-red-500 text-center">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
                <p className="text-sm font-medium text-green-500 text-center">Account created successfully! Redirecting...</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full h-11 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full h-11 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="w-full h-11 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="w-full h-11 px-4 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-sm"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 pb-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="rounded border-white/20 bg-white/10 text-white focus:ring-white/30"
              />
              <label htmlFor="terms" className="text-xs font-medium text-gray-300">
                I agree to the <Link href="#" className="text-white hover:underline transition-colors">Terms</Link> & <Link href="#" className="text-white hover:underline transition-colors">Privacy</Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 backdrop-blur-sm mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 pt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-white hover:underline transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}