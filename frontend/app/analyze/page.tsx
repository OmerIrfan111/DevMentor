"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AgentStatus = "waiting" | "running" | "complete" | "error";

interface AgentState {
  status: AgentStatus;
  band_message_id?: string;
}

const AGENT_META: Record<string, { label: string; tag: string; desc: string }> = {
  security: { label: "Security", tag: "SCAN", desc: "Auditing for vulnerabilities" },
  architect: { label: "Architect", tag: "ADR", desc: "Mapping architecture decisions" },
  onboarding: { label: "Onboarding", tag: "DOCS", desc: "Writing CONTRIBUTING.md" },
  mentor: { label: "Mentor", tag: "SOCRATIC", desc: "Generating Socratic feedback" },
};

const AGENT_ORDER = ["security", "architect", "onboarding", "mentor"];

interface BandMessage {
  agent: string;
  type: string;
  content: string;
}

function AnalyzeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const repoUrl = params.get("repo_url") ?? "";
  const githubToken = params.get("github_token") ?? undefined;
  const diffMode = params.get("diff_mode") === "true";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentState>>({
    security: { status: "waiting" },
    architect: { status: "waiting" },
    onboarding: { status: "waiting" },
    mentor: { status: "waiting" },
  });
  const [bandMessages, setBandMessages] = useState<BandMessage[]>([]);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repoUrl || started) return;
    setStarted(true);

    const token = getAuthToken();
    if (!token) {
      router.push(`/login?next=${encodeURIComponent(window.location.href)}`);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ repo_url: repoUrl, github_token: githubToken, diff_mode: diffMode }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? "Failed to start analysis");
        }
        const data = await res.json();

        if (data.status === "completed") {
          router.push(`/report/${data.session_id}`);
          return;
        }

        setSessionId(data.session_id);

        const es = new EventSource(
          `${BASE_URL}/analyze/stream/${data.session_id}?token=${encodeURIComponent(token)}`
        );
        sseRef.current = es;

        const handleEvent = (type: string, raw: string) => {
          try {
            const payload = JSON.parse(raw);
            if (type === "agent_update") {
              setAgents((prev) => ({
                ...prev,
                [payload.agent]: { ...prev[payload.agent], status: "running" },
              }));
            } else if (type === "agent_complete") {
              setAgents((prev) => ({
                ...prev,
                [payload.agent]: {
                  status: "complete",
                  band_message_id: payload.band_message_id,
                },
              }));
              if (payload.band_message_id) {
                setBandMessages((prev) => [
                  ...prev,
                  {
                    agent: payload.agent,
                    type: payload.output_type,
                    content: `${payload.agent.toUpperCase()} → ${payload.output_type}`,
                  },
                ]);
                if (bandRef.current) {
                  bandRef.current.scrollTop = bandRef.current.scrollHeight;
                }
              }
            } else if (type === "pipeline_complete") {
              es.close();
              setTimeout(() => router.push(`/report/${payload.session_id}`), 800);
            } else if (type === "pipeline_error") {
              setError(payload.error ?? "Pipeline failed");
              es.close();
            }
          } catch {
            // ignore parse errors
          }
        };

        for (const evtType of [
          "session_status", "agent_update", "agent_complete",
          "pipeline_complete", "pipeline_error",
        ]) {
          es.addEventListener(evtType, (e) => handleEvent(evtType, (e as MessageEvent).data));
        }
        es.onerror = () => setError("Connection to server lost");
      } catch (e: any) {
        setError(e.message);
      }
    })();

    return () => sseRef.current?.close();
  }, [repoUrl]);

  const completedCount = AGENT_ORDER.filter((a) => agents[a].status === "complete").length;

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .az-root { min-height: 100vh; background: #0a0a0a; color: #ffffff; font-family: 'Inter', sans-serif; }
        .az-nav {
          height: 52px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: stretch;
          position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #0a0a0a;
        }
        .az-nav-logo {
          display: flex; align-items: center; padding: 0 24px; border-right: 1px solid #1a1a1a;
          font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;
          letter-spacing: -0.02em; text-transform: uppercase; flex-shrink: 0;
        }
        .az-nav-repo {
          flex: 1; display: flex; align-items: center; padding: 0 20px;
          font-size: 11px; color: #333333; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .az-nav-progress {
          display: flex; align-items: center; padding: 0 20px; border-left: 1px solid #1a1a1a;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #555555; flex-shrink: 0; gap: 4px;
        }
        .az-nav-progress strong { color: #f5a623; }
        .az-body {
          max-width: 1100px; margin: 0 auto; padding: 80px 0 60px;
          display: grid; grid-template-columns: 1fr 280px; gap: 0;
          border-left: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;
        }
        @media (max-width: 768px) { .az-body { grid-template-columns: 1fr; } }
        .az-agents { padding: 40px 32px; border-right: 1px solid #1a1a1a; }
        .az-headline { font-size: 32px; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 6px; }
        .az-sub { font-size: 10px; color: #444444; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 40px; }
        .az-error {
          border: 1px solid #f5a62340; background: #f5a62308;
          padding: 12px 16px; font-size: 12px; color: #f5a623; margin-bottom: 24px;
        }
        .az-cards { display: flex; flex-direction: column; }
        .az-card {
          border: 1px solid #1a1a1a; padding: 24px 20px;
          display: flex; align-items: center; gap: 20px;
          transition: border-color 0.3s; background: #0a0a0a;
        }
        .az-card + .az-card { border-top: none; }
        .az-card.running { border-color: #f5a623; box-shadow: inset 0 0 0 1px #f5a62320; }
        .az-card.complete { border-color: #2a2a2a; }
        .az-card-num {
          font-size: 36px; font-weight: 900; letter-spacing: -0.04em; flex-shrink: 0;
          color: #1a1a1a; transition: color 0.3s; min-width: 48px; line-height: 1;
        }
        .az-card.running .az-card-num { color: #f5a623; }
        .az-card.complete .az-card-num { color: #333333; }
        .az-card-info { flex: 1; min-width: 0; }
        .az-card-tag {
          font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #333333; margin-bottom: 5px;
        }
        .az-card.running .az-card-tag { color: #f5a623; }
        .az-card.complete .az-card-tag { color: #555555; }
        .az-card-label { font-size: 18px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 3px; }
        .az-card-status-text { font-size: 11px; color: #444444; }
        .az-card.running .az-card-status-text { color: #888888; }
        .az-card.complete .az-card-status-text { color: #555555; }
        .az-progress-bar { height: 1px; background: #1a1a1a; margin-top: 12px; overflow: hidden; }
        .az-progress-inner {
          height: 100%; width: 40%;
          background: linear-gradient(90deg, transparent, #f5a623, transparent);
          animation: azslide 1.4s infinite;
        }
        .az-indicator { flex-shrink: 0; }
        .az-dot { width: 8px; height: 8px; background: #1a1a1a; }
        .az-card.running .az-dot { background: #f5a623; animation: azpulse 1.2s infinite; border-radius: 50%; }
        .az-card.complete .az-dot { background: #ffffff; }
        @keyframes azslide { 0%{transform:translateX(-150%)} 100%{transform:translateX(350%)} }
        @keyframes azpulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .az-band { padding: 40px 20px; }
        .az-band-head {
          font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #333333; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
        }
        .az-live-dot {
          width: 6px; height: 6px; background: #f5a623; border-radius: 50%;
          animation: azpulse 2s infinite; flex-shrink: 0;
        }
        .az-band-msgs { display: flex; flex-direction: column; gap: 1px; max-height: 500px; overflow-y: auto; }
        .az-empty { font-size: 11px; color: #222222; }
        .az-msg { border: 1px solid #1a1a1a; padding: 10px 12px; }
        .az-msg-agent {
          font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: #f5a623; margin-bottom: 3px;
        }
        .az-msg-text { font-size: 11px; color: #444444; }
      `}</style>

      <div className="az-root">
        <nav className="az-nav">
          <Link href="/" className="az-nav-logo">DM/Band</Link>
          <span className="az-nav-repo">{repoUrl || "—"}</span>
          <div className="az-nav-progress">
            <strong>{completedCount}</strong>/ 4 agents
          </div>
        </nav>

        <div className="az-body">
          <div className="az-agents">
            <h1 className="az-headline">Analysing repo.</h1>
            <p className="az-sub">4 agents running in sequence via Band · may take 1–2 minutes</p>

            {error && <div className="az-error">{error}</div>}

            <div className="az-cards">
              {AGENT_ORDER.map((key, idx) => {
                const meta = AGENT_META[key];
                const state = agents[key];
                const isRunning = state.status === "running";
                const isDone = state.status === "complete";

                return (
                  <div
                    key={key}
                    className={`az-card ${isRunning ? "running" : isDone ? "complete" : ""}`}
                  >
                    <div className="az-card-num">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="az-card-info">
                      <div className="az-card-tag">{meta.tag}</div>
                      <div className="az-card-label">{meta.label}</div>
                      <div className="az-card-status-text">
                        {isRunning ? meta.desc : isDone ? "Complete" : "Waiting"}
                      </div>
                      {isRunning && (
                        <div className="az-progress-bar">
                          <div className="az-progress-inner" />
                        </div>
                      )}
                    </div>
                    <div className="az-indicator">
                      <div className="az-dot" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="az-band">
            <div className="az-band-head">
              <span className="az-live-dot" />
              Band Room
            </div>
            <div className="az-band-msgs" ref={bandRef}>
              {bandMessages.length === 0 ? (
                <div className="az-empty">Waiting for agent messages…</div>
              ) : (
                bandMessages.map((msg, i) => (
                  <div key={i} className="az-msg">
                    <div className="az-msg-agent">{msg.agent} · {msg.type}</div>
                    <div className="az-msg-text">{msg.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Inter, sans-serif", color: "#333333", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Loading…</span>
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}
