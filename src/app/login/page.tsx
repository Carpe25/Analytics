"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, KeyRound, User, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Successfully logged in
      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-[#17212B]/15 rounded-2xl shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-[#17212B] text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#17212B]">
          Team Authorization
        </h1>
        <p className="text-xs text-[#17212B]/70">
          Sign in with your Developer or Manager credentials to access tickets and analytics.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17212B] flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-[#17212B]/60" />
            <span>Username</span>
          </label>
          <Input
            type="text"
            required
            autoFocus
            placeholder="e.g. jay, kaif, manager"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-10 text-xs rounded-xl bg-white border-[#17212B]/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17212B] flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-[#17212B]/60" />
            <span>Password</span>
          </label>
          <Input
            type="password"
            required
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 text-xs rounded-xl bg-white border-[#17212B]/20"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full h-10 rounded-xl text-xs font-semibold gap-2 mt-2"
        >
          {loading ? "Signing in..." : "Sign In to Portal"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </form>

      <div className="pt-4 border-t border-[#17212B]/10 text-center">
        <a
          href="/raise-ticket"
          className="text-xs text-[#17212B]/70 hover:text-[#17212B] hover:underline"
        >
          Need to raise a ticket instead? Go to Ticket Submission →
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F7F8] flex flex-col justify-center items-center px-4 font-sans">
      <Suspense fallback={<div className="text-xs text-[#17212B]/60">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
