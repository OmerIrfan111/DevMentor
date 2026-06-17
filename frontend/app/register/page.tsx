"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

function RegisterForm() {
  const [name, setName] = useState("");
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
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await api.register({ name, email, password });
      const tokenData = await api.login({ email, password });
      setAuthToken(tokenData.access_token, tokenData.expires_in);
      router.push(next);
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .rg-root {
          min-height: 100vh; background: #0a0a0a; color: #ffffff;
          font-family: 'Inter', sans-serif; display: flex; flex-direction: column;
        }
        .rg-nav {
          height: 52px; border-bottom: 1px solid #1a1a1a;
          display: flex; align-items: center; padding: 0 32px;
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #0a0a0a;
        }
        .rg-logo {
          font-size: 13px; font-weight: 700; color: #ffffff;
          text-decoration: none; letter-spacing: -0.02em; text-transform: uppercase;
        }
        .rg-body {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 80px 24px 40px;
        }
        .rg-panel { width: 100%; max-width: 380px; }
        .rg-eyebrow {
          font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #f5a623; margin-bottom: 20px;
        }
        .rg-headline {
          font-size: 36px; font-weight: 900; line-height: 1; letter-spacing: -0.04em;
          color: #ffffff; margin-bottom: 32px;
        }
        .rg-field { display: flex; flex-direction: column; }
        .rg-field + .rg-field { border-top: 1px solid #1a1a1a; }
        .rg-form-block { border: 1px solid #222222; margin-bottom: 16px; }
        .rg-label {
          display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #555555; padding: 10px 14px 0;
        }
        .rg-input {
          width: 100%; background: transparent; border: none; outline: none;
          color: #ffffff; font-family: 'Inter', sans-serif; font-size: 14px;
          padding: 6px 14px 10px; caret-color: #f5a623;
        }
        .rg-input::placeholder { color: #333333; }
        .rg-input:focus { background: #0f0f0f; }
        .rg-error {
          border: 1px solid #f5a62330; background: #f5a62308;
          padding: 10px 14px; font-size: 12px; color: #f5a623; margin-bottom: 16px;
        }
        .rg-submit {
          width: 100%; padding: 14px; background: #ffffff; color: #0a0a0a;
          border: none; border-radius: 0; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          transition: background 0.15s;
        }
        .rg-submit:hover:not(:disabled) { background: #f5a623; }
        .rg-submit:disabled { background: #333333; color: #555555; cursor: not-allowed; }
        .rg-terms {
          margin-top: 12px; font-size: 11px; color: #333333; text-align: center;
        }
        .rg-foot {
          margin-top: 20px; font-size: 12px; color: #555555; text-align: center;
        }
        .rg-foot a { color: #ffffff; text-decoration: none; font-weight: 500; }
        .rg-foot a:hover { color: #f5a623; }
      `}</style>

      <div className="rg-root">
        <nav className="rg-nav">
          <Link href="/" className="rg-logo">DevMentor / Band</Link>
        </nav>

        <div className="rg-body">
          <div className="rg-panel">
            <p className="rg-eyebrow">Get started</p>
            <h1 className="rg-headline">Create account.</h1>

            <form onSubmit={handleSubmit}>
              <div className="rg-form-block">
                <div className="rg-field">
                  <label className="rg-label" htmlFor="name">Name</label>
                  <input
                    id="name"
                    className="rg-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="rg-field">
                  <label className="rg-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="rg-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="rg-field">
                  <label className="rg-label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    className="rg-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && <div className="rg-error">{error}</div>}

              <button type="submit" className="rg-submit" disabled={loading}>
                {loading ? "Creating account…" : "Create account →"}
              </button>

              <p className="rg-terms">Free for the hackathon. No credit card required.</p>
            </form>

            <p className="rg-foot">
              Already have one? <Link href="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Inter, sans-serif", color: "#333333", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Loading…</span>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
