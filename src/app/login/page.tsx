"use client";

import { FormEvent, useMemo, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const url = new URL(window.location.href);
    return url.searchParams.get("next") || "/";
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next: nextPath }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Login failed.");
      window.location.href = nextPath || "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-xl font-semibold">EMS QA — Protected</h1>
        <p className="mt-1 text-sm text-white/70">
          Enter the shared password to access the site.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 p-2 text-white placeholder:text-white/40"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

