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

const AGENT_META: Record<string, { label: string; tag: string; color: string }> = {
  security: { label: "Security", tag: "SCAN", color: "#f59e0b" },
  architect: { label: "Architect", tag: "ADR", color: "#4361ee" },
  onboarding: { label: "Onboarding", tag: "DOCS", color: "#06b6d4" },
  mentor: { label: "Mentor", tag: "?→", color: "#a855f7" },
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
          body: JSON.stringify({ repo_url: repoUrl, github_token: githubToken }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? "Failed to start analysis");
        }
        const data = await res.json();
        setSessionId(data.session_id);

        // Open SSE stream
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
                    content: `${payload.agent.toUpperCase()} completed → ${payload.output_type}`,
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

  const activeAgent = AGENT_ORDER.find((a) => agents[a].status === "running") ?? null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        .analyze-root {
          min-height: 100vh; background: #0a0a10; color: #dde0f0;
          font-family: 'DM Sans', sans-serif; padding: 0;
        }
        .analyze-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 32px; border-bottom: 1px solid #1c1c2e;
          max-width: 1100px; margin: 0 auto;
        }
        .logo { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; color: #4361ee; text-decoration: none; }
        .repo-pill {
          font-family: 'Space Mono', monospace; font-size: 11px; color: #44446a;
          background: #13131c; border: 1px solid #1c1c2e; border-radius: 100px;
          padding: 4px 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .analyze-body {
          max-width: 1100px; margin: 0 auto; padding: 40px 32px;
          display: grid; grid-template-columns: 1fr 340px; gap: 24px;
        }
        @media (max-width: 768px) { .analyze-body { grid-template-columns: 1fr; } }
        .agents-col { display: flex; flex-direction: column; gap: 14px; }
        .agent-card {
          background: #0e0e17; border: 1px solid #1c1c2e; border-radius: 12px;
          padding: 20px 22px; display: flex; align-items: center; gap: 16px;
          transition: border-color 0.3s;
        }
        .agent-card.running { border-color: var(--ac); }
        .agent-card.complete { border-color: rgba(34,197,94,0.3); }
        .agent-icon {
          width: 40px; height: 40px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700;
          letter-spacing: 0.03em;
        }
        .agent-info { flex: 1; }
        .agent-label { font-size: 14px; font-weight: 600; color: #c8ccee; margin-bottom: 3px; }
        .agent-sub { font-size: 12px; color: #44446a; font-family: 'Space Mono', monospace; }
        .status-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: #2a2a3a;
        }
        .status-dot.running { background: var(--ac); animation: pulse 1.2s infinite; }
        .status-dot.complete { background: #22c55e; }
        .shimmer {
          height: 3px; border-radius: 2px; background: #1c1c2e; overflow: hidden; margin-top: 10px;
        }
        .shimmer-inner {
          height: 100%; width: 40%;
          background: linear-gradient(90deg, transparent, var(--ac), transparent);
          animation: slide 1.4s infinite;
        }
        @keyframes slide { 0%{transform:translateX(-150%)} 100%{transform:translateX(350%)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .band-col { }
        .band-card {
          background: #0e0e17; border: 1px solid #1c1c2e; border-radius: 12px;
          overflow: hidden; position: sticky; top: 20px;
        }
        .band-header {
          padding: 14px 16px; border-bottom: 1px solid #1c1c2e;
          display: flex; align-items: center; gap: 8px;
        }
        .band-dot { width: 6px; height: 6px; border-radius: 50%; background: #4361ee; animation: pulse 2s infinite; }
        .band-title { font-family: 'Space Mono', monospace; font-size: 11px; color: #44446a; letter-spacing: 0.08em; text-transform: uppercase; }
        .band-messages { padding: 12px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .band-msg {
          background: #13131c; border-radius: 7px; padding: 10px 12px;
          border-left: 2px solid var(--mc, #2a2a3a);
        }
        .band-msg-agent { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--mc, #44446a); margin-bottom: 3px; text-transform: uppercase; }
        .band-msg-text { font-size: 12px; color: #6668a0; line-height: 1.5; }
        .empty-band { padding: 24px; text-align: center; font-family: 'Space Mono', monospace; font-size: 11px; color: #2a2a44; }
        .error-box {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; padding: 16px; margin-bottom: 20px;
          font-size: 13px; color: #f87171;
        }
      `}</style>

      <div className="analyze-root">
        <header className="analyze-header">
          <Link href="/" className="logo">DM/Band</Link>
          <span className="repo-pill">{repoUrl || "—"}</span>
        </header>

        <div className="analyze-body">
          <div className="agents-col">
            {error && <div className="error-box">{error}</div>}

            {AGENT_ORDER.map((key) => {
              const meta = AGENT_META[key];
              const state = agents[key];
              const isRunning = state.status === "running";
              const isDone = state.status === "complete";

              return (
                <div
                  key={key}
                  className={`agent-card ${isRunning ? "running" : isDone ? "complete" : ""}`}
                  style={{ "--ac": meta.color } as React.CSSProperties}
                >
                  <div
                    className="agent-icon"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    {meta.tag}
                  </div>
                  <div className="agent-info">
                    <div className="agent-label">{meta.label}</div>
                    <div className="agent-sub">
                      {isRunning ? "Processing…" : isDone ? "Complete" : "Waiting"}
                    </div>
                    {isRunning && (
                      <div className="shimmer">
                        <div className="shimmer-inner" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`status-dot ${isRunning ? "running" : isDone ? "complete" : ""}`}
                    style={{ "--ac": meta.color } as React.CSSProperties}
                  />
                </div>
              );
            })}
          </div>

          <div className="band-col">
            <div className="band-card">
              <div className="band-header">
                <span className="band-dot" />
                <span className="band-title">Band Room</span>
              </div>
              <div className="band-messages" ref={bandRef}>
                {bandMessages.length === 0 ? (
                  <div className="empty-band">Waiting for agent messages…</div>
                ) : (
                  bandMessages.map((msg, i) => {
                    const color = AGENT_META[msg.agent]?.color ?? "#4361ee";
                    return (
                      <div
                        key={i}
                        className="band-msg"
                        style={{ "--mc": color } as React.CSSProperties}
                      >
                        <div className="band-msg-agent">{msg.agent} · {msg.type}</div>
                        <div className="band-msg-text">{msg.content}</div>
                      </div>
                    );
                  })
                )}
              </div>
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
      <div style={{ minHeight: "100vh", background: "#0a0a10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "monospace", color: "#44446a", fontSize: 13 }}>Loading…</span>
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}
