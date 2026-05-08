"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.forgotPassword(email);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(true);
        setMessage("If an account exists with that email, you will receive a password reset link.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-background border border-border rounded-xl p-8 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-destructive/20 p-4">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-md bg-accent/20 p-4">
              <p className="text-sm font-medium text-accent-foreground">{message}</p>
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="appearance-none rounded-md mt-1 block w-full px-3 py-2 border border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </div>
        </form>
        <div className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}