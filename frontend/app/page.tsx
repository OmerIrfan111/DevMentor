"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, clearAuthToken } from "@/lib/auth";

const AGENTS = [
  {
    tag: "SCAN",
    label: "Security",
    color: "#f5a623",
    desc: "Hardcoded secrets, injection risks, missing validation, and CORS misconfigurations — severity ranked HIGH / MEDIUM / LOW.",
    score: "9.2",
  },
  {
    tag: "ADR",
    label: "Architect",
    color: "#ffffff",
    desc: "Architectural Decision Record — technology choices, structural patterns, anti-patterns, and tradeoffs at scale.",
    score: "9.5",
  },
  {
    tag: "DOCS",
    label: "Onboarding",
    color: "#ffffff",
    desc: "CONTRIBUTING.md, local setup walkthrough, and three first-good-issues tailored to your repo's anti-patterns.",
    score: "9.1",
  },
  {
    tag: "?→",
    label: "Mentor",
    color: "#ffffff",
    desc: "Socratic questions instead of corrections. Understand why patterns matter — not just what to change.",
    score: "9.8",
  },
];

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => { setAuthed(isAuthenticated()); }, []);

  const handleSignOut = () => { clearAuthToken(); setAuthed(false); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    if (!isAuthenticated()) {
      router.push(`/login?next=${encodeURIComponent("/analyze?" + new URLSearchParams({ repo_url: repoUrl.trim() }).toString())}`);
      return;
    }
    const p = new URLSearchParams({ repo_url: repoUrl.trim() });
    if (githubToken.trim()) p.set("github_token", githubToken.trim());
    if (diffMode) p.set("diff_mode", "true");
    router.push(`/analyze?${p.toString()}`);
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --black: #0a0a0a;
          --black-2: #111111;
          --black-3: #1a1a1a;
          --white: #ffffff;
          --grey-1: #999999;
          --grey-2: #555555;
          --grey-3: #2a2a2a;
          --orange: #f5a623;
          --font: 'Inter', -apple-system, sans-serif;
        }

        html, body { background: var(--black); color: var(--white); }

        .root { font-family: var(--font); background: var(--black); min-height: 100vh; }

        /* ── NAV ── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; height: 52px;
          background: rgba(10,10,10,0.9);
          border-bottom: 1px solid var(--black-3);
          backdrop-filter: blur(8px);
        }
        .nav-left { display: flex; align-items: center; gap: 24px; }
        .logo {
          font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
          color: var(--white); text-decoration: none; text-transform: uppercase;
        }
        .logo span { color: var(--orange); }
        .nav-tag {
          font-size: 9px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--grey-2);
          border: 1px solid var(--grey-3); border-radius: 2px; padding: 2px 6px;
        }
        .nav-right { display: flex; align-items: center; gap: 0; }
        .nav-link {
          font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--grey-1);
          text-decoration: none; padding: 0 16px; height: 52px;
          display: flex; align-items: center;
          border-left: 1px solid var(--black-3);
          transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover { color: var(--white); background: var(--black-2); }
        .nav-link-cta {
          font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; color: var(--black);
          background: var(--white); text-decoration: none;
          padding: 0 20px; height: 52px; display: flex; align-items: center;
          border-left: 1px solid var(--black-3);
          transition: background 0.15s;
        }
        .nav-link-cta:hover { background: #e0e0e0; }

        /* ── HERO ── */
        .hero {
          padding-top: 52px; /* nav offset */
          min-height: 100vh;
          display: grid;
          grid-template-rows: 1fr auto;
          border-bottom: 1px solid var(--black-3);
        }
        .hero-top {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid var(--black-3);
        }
        .hero-left {
          padding: 64px 56px;
          border-right: 1px solid var(--black-3);
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .hero-eyebrow {
          font-size: 9px; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--grey-2);
          margin-bottom: 40px;
        }
        .hero-h1 {
          font-size: clamp(48px, 6.5vw, 96px);
          font-weight: 900; line-height: 0.95;
          letter-spacing: -0.04em;
          color: var(--white);
        }
        .hero-h1 em {
          font-style: italic; font-weight: 300;
          color: var(--grey-1);
        }
        .hero-meta {
          margin-top: 48px;
          display: flex; align-items: center; gap: 32px;
        }
        .hero-meta-item { }
        .hero-meta-value {
          font-size: 28px; font-weight: 800; letter-spacing: -0.04em; color: var(--white);
          display: block;
        }
        .hero-meta-label {
          font-size: 9px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--grey-2);
          margin-top: 2px; display: block;
        }
        .hero-meta-divider { width: 1px; height: 40px; background: var(--black-3); }

        .hero-right {
          padding: 64px 56px;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .hero-desc {
          font-size: 15px; font-weight: 400; line-height: 1.7;
          color: var(--grey-1); max-width: 400px; margin-bottom: 48px;
        }

        /* ── FORM ── */
        .form { display: flex; flex-direction: column; gap: 0; }
        .form-field {
          border: 1px solid var(--black-3); background: var(--black-2);
          transition: border-color 0.15s;
        }
        .form-field:focus-within { border-color: var(--grey-2); }
        .form-field + .form-field { margin-top: -1px; }
        .form-field-label {
          display: block; padding: 10px 16px 0;
          font-size: 8px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--grey-2);
        }
        .form-input {
          display: block; width: 100%; background: transparent; border: none;
          outline: none; padding: 6px 16px 12px;
          font-family: var(--font); font-size: 13px;
          color: var(--white);
        }
        .form-input::placeholder { color: var(--grey-3); }
        .form-input[type="password"] { letter-spacing: 0.05em; }
        .form-options {
          display: flex; align-items: center; gap: 0;
          border: 1px solid var(--black-3); border-top: none;
          background: var(--black-2);
        }
        .token-btn {
          flex: 1; background: none; border: none; border-right: 1px solid var(--black-3);
          padding: 12px 16px; cursor: pointer;
          font-family: var(--font); font-size: 10px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--grey-2); text-align: left;
          transition: color 0.15s;
        }
        .token-btn:hover { color: var(--white); }
        .diff-wrap {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
        }
        .toggle {
          position: relative; width: 32px; height: 16px; flex-shrink: 0; cursor: pointer;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-track {
          position: absolute; inset: 0; border-radius: 16px;
          background: var(--black-3); transition: background 0.2s;
          border: 1px solid var(--grey-3);
        }
        .toggle-thumb {
          position: absolute; width: 10px; height: 10px; border-radius: 50%;
          top: 2px; left: 2px; background: var(--grey-2);
          transition: transform 0.2s, background 0.2s;
        }
        .toggle input:checked ~ .toggle-track { background: var(--white); border-color: var(--white); }
        .toggle input:checked ~ .toggle-thumb { transform: translateX(16px); background: var(--black); }
        .diff-label {
          font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--grey-2); cursor: pointer; user-select: none;
        }
        .beta { font-size: 8px; color: var(--orange); border: 1px solid rgba(245,166,35,0.3); border-radius: 2px; padding: 1px 5px; letter-spacing: 0.08em; }
        .submit-btn {
          width: 100%; padding: 18px; border: none; cursor: pointer;
          font-family: var(--font); font-size: 11px; font-weight: 800;
          letter-spacing: 0.12em; text-transform: uppercase;
          background: var(--white); color: var(--black);
          transition: background 0.15s;
          margin-top: 2px;
        }
        .submit-btn:hover { background: #e0e0e0; }

        /* ── HERO BOTTOM TICKER ── */
        .hero-bottom {
          display: flex; align-items: center; overflow: hidden; height: 44px;
        }
        .ticker-label {
          padding: 0 24px; height: 44px; display: flex; align-items: center;
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--black); background: var(--white);
          white-space: nowrap; border-right: 1px solid var(--black-3); flex-shrink: 0;
        }
        .ticker-track {
          flex: 1; overflow: hidden;
          font-size: 11px; font-weight: 500; letter-spacing: 0.06em;
          text-transform: uppercase; color: var(--grey-2);
          display: flex; align-items: center; gap: 48px;
          white-space: nowrap; animation: ticker 30s linear infinite;
          padding-left: 32px;
        }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-dot { color: var(--orange); flex-shrink: 0; }

        /* ── AGENTS SECTION ── */
        .section-header {
          display: flex; align-items: baseline; justify-content: space-between;
          padding: 32px 24px;
          border-bottom: 1px solid var(--black-3);
        }
        .section-title {
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--grey-2);
        }
        .section-count {
          font-size: 9px; font-weight: 500; letter-spacing: 0.06em;
          color: var(--grey-2);
        }
        .agents-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
        }
        .agent-card {
          border-right: 1px solid var(--black-3);
          border-bottom: 1px solid var(--black-3);
          transition: background 0.2s;
          cursor: default;
        }
        .agent-card:last-child { border-right: none; }
        .agent-card:hover { background: var(--black-2); }
        .agent-card-top {
          padding: 28px 24px 20px;
          border-bottom: 1px solid var(--black-3);
          display: flex; align-items: flex-start; justify-content: space-between;
        }
        .agent-tag-pill {
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--black);
          background: var(--white); padding: 4px 8px; border-radius: 2px;
        }
        .agent-score {
          text-align: right;
        }
        .agent-score-val {
          font-size: 22px; font-weight: 900; letter-spacing: -0.04em;
          color: var(--white); line-height: 1; display: block;
        }
        .agent-score-label {
          font-size: 8px; font-weight: 500; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--grey-2); display: block; margin-top: 2px;
        }
        .agent-card-body { padding: 20px 24px 28px; }
        .agent-name {
          font-size: 15px; font-weight: 700; letter-spacing: -0.02em;
          color: var(--white); margin-bottom: 12px;
        }
        .agent-desc { font-size: 12px; line-height: 1.7; color: var(--grey-2); }

        /* ── FOOTER ── */
        .footer {
          border-top: 1px solid var(--black-3);
          display: grid; grid-template-columns: 1fr 1fr;
        }
        .footer-left {
          padding: 40px 24px; border-right: 1px solid var(--black-3);
          display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
        }
        .footer-logo { font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: var(--white); }
        .footer-logo span { color: var(--orange); }
        .footer-copy { font-size: 10px; color: var(--grey-2); letter-spacing: 0.04em; }
        .footer-right {
          padding: 40px 24px;
          display: flex; align-items: center; justify-content: flex-end; gap: 32px;
        }
        .footer-link {
          font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--grey-2); text-decoration: none;
          transition: color 0.15s;
        }
        .footer-link:hover { color: var(--white); }

        @media (max-width: 768px) {
          .hero-top { grid-template-columns: 1fr; }
          .hero-left { border-right: none; padding: 40px 24px; }
          .hero-right { padding: 40px 24px; }
          .agents-grid { grid-template-columns: 1fr 1fr; }
          .agent-card:nth-child(2) { border-right: none; }
          .footer { grid-template-columns: 1fr; }
          .footer-left { border-right: none; }
        }
        @media (max-width: 480px) {
          .agents-grid { grid-template-columns: 1fr; }
          .agent-card { border-right: none; }
        }
      `}</style>

      <div className="root">
        {/* Nav */}
        <nav className="nav">
          <div className="nav-left">
            <Link href="/" className="logo">Dev<span>Mentor</span></Link>
            <span className="nav-tag">Band</span>
          </div>
          <div className="nav-right">
            {authed ? (
              <>
                <Link href="/analyze" className="nav-link">Analyse</Link>
                <button onClick={handleSignOut} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer", borderLeft: "1px solid var(--black-3)" }}>Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link">Sign in</Link>
                <Link href="/register" className="nav-link-cta">Get started</Link>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-top">
            <div className="hero-left">
              <div>
                <p className="hero-eyebrow">Multi-agent code mentorship · Hackathon 2026</p>
                <h1 className="hero-h1">
                  The AI<br />
                  your code<br />
                  <em>deserves</em>
                </h1>
              </div>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-value">4</span>
                  <span className="hero-meta-label">AI agents</span>
                </div>
                <div className="hero-meta-divider" />
                <div className="hero-meta-item">
                  <span className="hero-meta-value">90s</span>
                  <span className="hero-meta-label">Avg runtime</span>
                </div>
                <div className="hero-meta-divider" />
                <div className="hero-meta-item">
                  <span className="hero-meta-value">∞</span>
                  <span className="hero-meta-label">Repos</span>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <p className="hero-desc">
                Paste a GitHub repo URL. Four specialized AI agents collaborate to produce
                security findings, an ADR, onboarding docs, and Socratic mentorship — all in one run.
              </p>

              <form className="form" onSubmit={handleSubmit}>
                <div className="form-field">
                  <label className="form-field-label" htmlFor="repo-url">Repository URL</label>
                  <input
                    id="repo-url"
                    className="form-input"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    required
                    autoComplete="off"
                  />
                </div>

                {showToken && (
                  <div className="form-field">
                    <label className="form-field-label">GitHub Token</label>
                    <input
                      className="form-input"
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_••••••••••••••••"
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="form-options">
                  <button type="button" className="token-btn" onClick={() => setShowToken(v => !v)}>
                    {showToken ? "− Remove" : "+ Add"} GitHub token
                  </button>
                  <div className="diff-wrap">
                    <label className="toggle">
                      <input type="checkbox" checked={diffMode} onChange={e => setDiffMode(e.target.checked)} />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                    <span className="diff-label" onClick={() => setDiffMode(v => !v)}>Diff</span>
                    <span className="beta">BETA</span>
                  </div>
                </div>

                <button type="submit" className="submit-btn">
                  Analyse now →
                </button>
              </form>
            </div>
          </div>

          {/* Ticker */}
          <div className="hero-bottom">
            <span className="ticker-label">Live pipeline</span>
            <div className="ticker-track">
              {[...Array(2)].map((_, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <span>Security scan</span>
                  <span className="ticker-dot">·</span>
                  <span>Architecture ADR</span>
                  <span className="ticker-dot">·</span>
                  <span>Onboarding docs</span>
                  <span className="ticker-dot">·</span>
                  <span>Socratic mentor</span>
                  <span className="ticker-dot">·</span>
                  <span>Band agents</span>
                  <span className="ticker-dot">·</span>
                  <span>DeepSeek AI</span>
                  <span className="ticker-dot">·</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Agents */}
        <div className="section-header">
          <span className="section-title">Agent pipeline</span>
          <span className="section-count">04 agents</span>
        </div>
        <div className="agents-grid">
          {AGENTS.map((a) => (
            <div key={a.label} className="agent-card">
              <div className="agent-card-top">
                <span className="agent-tag-pill">{a.tag}</span>
                <div className="agent-score">
                  <span className="agent-score-val">{a.score}</span>
                  <span className="agent-score-label">Score</span>
                </div>
              </div>
              <div className="agent-card-body">
                <div className="agent-name">{a.label} Agent</div>
                <p className="agent-desc">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-left">
            <div className="footer-logo">Dev<span>Mentor</span></div>
            <span className="footer-copy">© 2026 DevMentor Band · Band of Agents Hackathon</span>
          </div>
          <div className="footer-right">
            <Link href="/login" className="footer-link">Sign in</Link>
            <Link href="/register" className="footer-link">Register</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
