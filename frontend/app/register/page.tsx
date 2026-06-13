"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      router.push("/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        .auth-root {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center;
          justify-content: center; background: #0a0a10; padding: 24px;
          font-family: 'DM Sans', sans-serif; color: #dde0f0;
          position: relative; overflow: hidden;
        }
        .auth-orb {
          position: fixed; border-radius: 50%; pointer-events: none; filter: blur(120px);
          width: 500px; height: 500px; top: -100px; left: 50%; transform: translateX(-50%);
          background: rgba(67,97,238,0.1); z-index: 0;
        }
        .auth-card {
          position: relative; z-index: 1; width: 100%; max-width: 400px;
          background: #0e0e17; border: 1px solid #1c1c2e; border-radius: 16px;
          padding: 36px 32px;
        }
        .auth-logo {
          font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700;
          color: #4361ee; border: 1px solid rgba(67,97,238,0.3); border-radius: 5px;
          padding: 2px 7px; display: inline-block; margin-bottom: 28px;
          text-decoration: none;
        }
        .auth-title {
          font-family: 'Space Mono', monospace; font-size: 22px; font-weight: 700;
          color: #dde0f0; margin-bottom: 6px;
        }
        .auth-sub { font-size: 13px; color: #44446a; margin-bottom: 28px; }
        .auth-sub a { color: #4361ee; text-decoration: none; }
        .auth-sub a:hover { text-decoration: underline; }
        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .field-label {
          font-size: 12px; font-weight: 500; color: #55567a;
          font-family: 'Space Mono', monospace; letter-spacing: 0.05em;
        }
        .field-input {
          background: #13131c; border: 1px solid #22223a; border-radius: 8px;
          padding: 11px 14px; font-size: 13px; color: #dde0f0; outline: none;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.2s;
        }
        .field-input:focus { border-color: rgba(67,97,238,0.5); }
        .field-input::placeholder { color: #2a2a44; }
        .error-msg {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 7px; padding: 10px 12px; font-size: 12px; color: #f87171;
          margin-bottom: 14px;
        }
        .auth-btn {
          width: 100%; padding: 13px; border-radius: 9px;
          background: #4361ee; color: #fff; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px;
          box-shadow: 0 4px 24px rgba(67,97,238,0.2);
          transition: background 0.2s, opacity 0.2s; margin-top: 4px;
        }
        .auth-btn:hover:not(:disabled) { background: #3751d4; }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .terms {
          font-size: 11px; color: #2a2a44; text-align: center; margin-top: 14px; line-height: 1.5;
        }
      `}</style>

      <div className="auth-root">
        <div className="auth-orb" aria-hidden />
        <div className="auth-card">
          <Link href="/" className="auth-logo">DM/</Link>
          <h1 className="auth-title">Create account.</h1>
          <p className="auth-sub">
            Already have one? <Link href="/login">Sign in</Link>
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="name">Name</label>
              <input
                id="name"
                className="field-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Creating account…" : "Create account →"}
            </button>

            <p className="terms">
              Free for the hackathon. No credit card required.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
