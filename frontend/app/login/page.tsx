"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      setAuthToken(data.access_token, data.expires_in);
      router.push(next);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lg-root {
          min-height: 100vh; background: #0a0a0a; color: #ffffff;
          font-family: 'Inter', sans-serif; display: flex; flex-direction: column;
        }
        .lg-nav {
          height: 52px; border-bottom: 1px solid #1a1a1a;
          display: flex; align-items: center; padding: 0 32px;
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #0a0a0a;
        }
        .lg-logo {
          font-size: 13px; font-weight: 700; color: #ffffff;
          text-decoration: none; letter-spacing: -0.02em; text-transform: uppercase;
        }
        .lg-body {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 80px 24px 40px;
        }
        .lg-panel {
          width: 100%; max-width: 380px;
        }
        .lg-eyebrow {
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #f5a623; margin-bottom: 20px;
        }
        .lg-headline {
          font-size: 36px; font-weight: 900; line-height: 1; letter-spacing: -0.04em;
          color: #ffffff; margin-bottom: 32px;
        }
        .lg-field { display: flex; flex-direction: column; margin-bottom: 0; }
        .lg-field + .lg-field { border-top: 1px solid #1a1a1a; }
        .lg-form-block {
          border: 1px solid #222222; margin-bottom: 16px;
        }
        .lg-label {
          display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #555555; padding: 10px 14px 0;
        }
        .lg-input {
          width: 100%; background: transparent; border: none; outline: none;
          color: #ffffff; font-family: 'Inter', sans-serif; font-size: 14px;
          padding: 6px 14px 10px; caret-color: #f5a623;
        }
        .lg-input::placeholder { color: #333333; }
        .lg-input:focus { background: #0f0f0f; }
        .lg-error {
          border: 1px solid #f5a62330; background: #f5a62308;
          padding: 10px 14px; font-size: 12px; color: #f5a623;
          margin-bottom: 16px;
        }
        .lg-submit {
          width: 100%; padding: 14px; background: #ffffff; color: #0a0a0a;
          border: none; border-radius: 0; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          transition: background 0.15s, color 0.15s;
        }
        .lg-submit:hover:not(:disabled) { background: #f5a623; }
        .lg-submit:disabled { background: #333333; color: #555555; cursor: not-allowed; }
        .lg-foot {
          margin-top: 20px; font-size: 12px; color: #555555; text-align: center;
        }
        .lg-foot a { color: #ffffff; text-decoration: none; font-weight: 500; }
        .lg-foot a:hover { color: #f5a623; }
      `}</style>

      <div className="lg-root">
        <nav className="lg-nav">
          <Link href="/" className="lg-logo">DevMentor / Band</Link>
        </nav>

        <div className="lg-body">
          <div className="lg-panel">
            <p className="lg-eyebrow">Welcome back</p>
            <h1 className="lg-headline">Sign in.</h1>

            <form onSubmit={handleSubmit}>
              <div className="lg-form-block">
                <div className="lg-field">
                  <label className="lg-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="lg-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    className="lg-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && <div className="lg-error">{error}</div>}

              <button type="submit" className="lg-submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>

            <p className="lg-foot">
              No account? <Link href="/register">Create one free</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Inter, sans-serif", color: "#333333", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Loading…</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
