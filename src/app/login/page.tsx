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
    <main className="login-page">
      <div className="login-card">
        <div className="flex items-center gap-3">
          <div className="brand-mark" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <p className="brand-eyebrow">Clinical &amp; Operations QA</p>
            <h1 className="text-xl font-bold tracking-tight text-white">EMS OpsQA</h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-white/65">
          Sign in to access your organization&apos;s quality assurance dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-white/80">
            Password
            <input
              className="login-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/35">
          Secure access for authorized personnel only
        </p>
      </div>
    </main>
  );
}
