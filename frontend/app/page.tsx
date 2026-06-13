"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AGENTS = [
  {
    tag: "ADR",
    label: "Architect",
    color: "#4361ee",
    bg: "rgba(67,97,238,0.08)",
    body: "Produces an Architectural Decision Record — technology choices, structural patterns, anti-patterns to fix, and known tradeoffs at scale.",
  },
  {
    tag: "DOCS",
    label: "Onboarding",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.08)",
    body: "Writes your CONTRIBUTING.md, a local setup walkthrough, and three first-good-issues tailored to the exact anti-patterns in your repo.",
  },
  {
    tag: "?→",
    label: "Mentor",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.08)",
    body: "Asks Socratic questions instead of correcting. Guides you to understand why patterns matter — not just what to change.",
  },
];

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    const p = new URLSearchParams({ repo_url: repoUrl.trim() });
    if (githubToken.trim()) p.set("github_token", githubToken.trim());
    router.push(`/analyze?${p.toString()}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');

        .page-root {
          font-family: 'DM Sans', sans-serif;
          background: #0a0a10;
          color: #dde0f0;
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
        }
        .font-mono-brand { font-family: 'Space Mono', monospace; }

        /* Dot grid */
        .dot-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, rgba(67,97,238,0.18) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.5;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, black 40%, transparent 100%);
        }
        /* Glow orbs */
        .orb { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(120px); }
        .orb-1 { width: 700px; height: 500px; top: -150px; left: 50%; transform: translateX(-50%); background: rgba(67,97,238,0.12); }
        .orb-2 { width: 400px; height: 400px; top: 40%; right: -100px; background: rgba(120,40,180,0.1); }
        .orb-3 { width: 350px; height: 350px; bottom: 0; left: -80px; background: rgba(67,97,238,0.07); }

        /* Header */
        .header {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 32px; max-width: 1100px; margin: 0 auto;
        }
        .logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .logo-mark {
          font-family: 'Space Mono', monospace;
          font-weight: 700; font-size: 15px; color: #4361ee;
          border: 1px solid rgba(67,97,238,0.4); border-radius: 6px;
          padding: 2px 7px;
        }
        .logo-sub {
          font-family: 'Space Mono', monospace;
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #55567a;
        }
        .nav { display: flex; align-items: center; gap: 12px; }
        .nav-link {
          font-size: 13px; color: #55567a; text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: #dde0f0; }
        .nav-btn {
          font-size: 13px; padding: 7px 16px; border-radius: 7px;
          border: 1px solid rgba(67,97,238,0.35); color: #4361ee;
          text-decoration: none; background: transparent;
          transition: background 0.2s, border-color 0.2s;
        }
        .nav-btn:hover { background: rgba(67,97,238,0.1); border-color: rgba(67,97,238,0.6); }

        /* Hero */
        .hero {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center;
          padding: 80px 24px 100px; text-align: center;
        }
        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 100px;
          border: 1px solid rgba(67,97,238,0.25); background: rgba(67,97,238,0.06);
          margin-bottom: 36px;
        }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #4361ee; animation: pulse 2s infinite; }
        .badge-text {
          font-family: 'Space Mono', monospace; font-size: 10px;
          color: #55567a; letter-spacing: 0.1em; text-transform: uppercase;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .hero-h1 {
          font-family: 'Space Mono', monospace;
          font-size: clamp(36px, 7vw, 76px);
          line-height: 1.06; font-weight: 700;
          letter-spacing: -0.02em; margin-bottom: 8px;
          max-width: 820px;
        }
        .h1-accent { color: #4361ee; }
        .h1-muted {
          display: block; font-size: 0.62em;
          color: #393a5a; font-weight: 400; margin-top: 6px;
          letter-spacing: 0;
        }

        .hero-sub {
          max-width: 580px; margin: 24px auto 48px;
          font-size: 15px; color: #6668a0; line-height: 1.7;
        }
        .hero-sub code {
          font-family: 'Space Mono', monospace;
          font-size: 12px; color: #4361ee;
          background: rgba(67,97,238,0.1); padding: 1px 5px; border-radius: 4px;
        }
        .hero-sub strong { color: #c8ccee; }

        /* Form */
        .form { width: 100%; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .input-row {
          display: flex; align-items: center;
          background: #13131c; border: 1px solid #22223a;
          border-radius: 10px; overflow: hidden;
          transition: border-color 0.2s;
        }
        .input-row:focus-within { border-color: rgba(67,97,238,0.5); }
        .input-prefix {
          padding: 0 14px; font-family: 'Space Mono', monospace;
          font-size: 13px; color: #4361ee;
          border-right: 1px solid #22223a; white-space: nowrap;
          line-height: 50px;
        }
        .url-input {
          flex: 1; background: transparent; border: none; outline: none;
          padding: 0 16px; font-family: 'Space Mono', monospace;
          font-size: 13px; color: #dde0f0; height: 50px;
        }
        .url-input::placeholder { color: #2a2a44; }
        .token-row { display: flex; align-items: center; gap: 8px; }
        .token-toggle {
          background: none; border: none; cursor: pointer;
          font-family: 'Space Mono', monospace; font-size: 11px; color: #393a5a;
          transition: color 0.2s; padding: 0;
        }
        .token-toggle:hover { color: #6668a0; }
        .tip-wrap { position: relative; }
        .tip-btn {
          background: none; border: none; cursor: pointer;
          font-size: 12px; color: #2a2a44; transition: color 0.2s; padding: 0; line-height: 1;
        }
        .tip-btn:hover { color: #55567a; }
        .tooltip {
          position: absolute; bottom: calc(100% + 8px); left: 0;
          width: 220px; background: #13131c; border: 1px solid #22223a;
          border-radius: 7px; padding: 9px 12px;
          font-size: 12px; color: #6668a0; z-index: 30;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5); pointer-events: none;
        }
        .token-input {
          background: #13131c; border: 1px solid #22223a; border-radius: 10px;
          padding: 13px 16px; font-family: 'Space Mono', monospace;
          font-size: 12px; color: #dde0f0; outline: none; width: 100%;
          transition: border-color 0.2s;
        }
        .token-input::placeholder { color: #2a2a44; }
        .token-input:focus { border-color: rgba(67,97,238,0.45); }
        .cta-btn {
          width: 100%; padding: 15px; border-radius: 10px;
          background: #4361ee; color: #fff; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 32px rgba(67,97,238,0.25);
          transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .cta-btn:hover { background: #3751d4; box-shadow: 0 6px 40px rgba(67,97,238,0.4); }
        .cta-btn:active { transform: scale(0.985); }

        /* Agent cards */
        .agents-section {
          position: relative; z-index: 10;
          max-width: 1060px; margin: 0 auto; padding: 0 24px 100px;
        }
        .agents-label {
          text-align: center; margin-bottom: 40px;
          font-family: 'Space Mono', monospace; font-size: 10px;
          letter-spacing: 0.15em; text-transform: uppercase; color: #2a2a44;
        }
        .agents-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .agent-card {
          background: #0e0e17; border: 1px solid #1c1c2e;
          border-radius: 14px; padding: 24px;
          transition: border-color 0.25s, transform 0.2s;
          cursor: default;
        }
        .agent-card:hover { border-color: var(--card-color); transform: translateY(-2px); }
        .agent-icon {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em;
        }
        .agent-name {
          font-size: 15px; font-weight: 600; color: #c8ccee; margin-bottom: 8px;
        }
        .agent-body { font-size: 13px; color: #44446a; line-height: 1.65; }
        .agent-body code {
          font-family: 'Space Mono', monospace; font-size: 11px;
          background: rgba(67,97,238,0.1); color: #4361ee;
          padding: 1px 4px; border-radius: 3px;
        }

        /* Footer divider */
        .divider { max-width: 1060px; margin: 0 auto; height: 1px; background: #1c1c2e; }
      `}</style>

      <div className="page-root">
        <div className="dot-grid" aria-hidden />
        <div className="orb orb-1" aria-hidden />
        <div className="orb orb-2" aria-hidden />
        <div className="orb orb-3" aria-hidden />

        {/* Header */}
        <header className="header">
          <Link href="/" className="logo">
            <span className="logo-mark">DM/</span>
            <span className="logo-sub">Band</span>
          </Link>
          <nav className="nav">
            <Link href="/login" className="nav-link">Login</Link>
            <Link href="/register" className="nav-btn">Register</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="hero">
          <div className="badge">
            <span className="badge-dot" />
            <span className="badge-text">Band of Agents Hackathon 2026</span>
          </div>

          <h1 className="hero-h1">
            Your <span className="h1-accent">AI Senior</span>
            <br />Dev Team.
            <span className="h1-muted">No gatekeeping.</span>
          </h1>

          <p className="hero-sub">
            Submit a GitHub repo. Four AI agents collaborate to give you architectural feedback,
            a <code>CONTRIBUTING.md</code>, and Socratic mentorship —{" "}
            <strong>in under 90 seconds.</strong>
          </p>

          <form className="form" onSubmit={handleSubmit}>
            <div className="input-row">
              <span className="input-prefix">$ url</span>
              <input
                className="url-input"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                required
                autoComplete="off"
              />
            </div>

            <div className="token-row">
              <button
                type="button"
                className="token-toggle"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? "▼" : "▶"} github token (optional)
              </button>
              <div className="tip-wrap">
                <button
                  type="button"
                  className="tip-btn"
                  onMouseEnter={() => setShowTip(true)}
                  onMouseLeave={() => setShowTip(false)}
                  aria-label="Token info"
                >
                  ⓘ
                </button>
                {showTip && (
                  <div className="tooltip">
                    Increases rate limits for private/large repos
                  </div>
                )}
              </div>
            </div>

            {showToken && (
              <input
                className="token-input"
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_••••••••••••••••••••••••••••••••••••••"
                autoComplete="off"
              />
            )}

            <button type="submit" className="cta-btn">
              Analyse with AI →
            </button>
          </form>
        </section>

        {/* Agent explainer */}
        <section className="agents-section">
          <p className="agents-label">Four agents. One band.</p>
          <div className="agents-grid">
            {AGENTS.map((a) => (
              <div
                key={a.label}
                className="agent-card"
                style={{ "--card-color": a.color } as React.CSSProperties}
              >
                <div
                  className="agent-icon"
                  style={{ background: a.bg, color: a.color }}
                >
                  {a.tag}
                </div>
                <div className="agent-name">{a.label}</div>
                <p
                  className="agent-body"
                  dangerouslySetInnerHTML={{
                    __html: a.body.replace(
                      /CONTRIBUTING\.md/g,
                      '<code>CONTRIBUTING.md</code>'
                    ),
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />
      </div>
    </>
  );
}
