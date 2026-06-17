"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Report, type SecurityFinding, type MentorFeedback, type FirstGoodIssue } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import MarkdownViewer from "@/components/MarkdownViewer";

type TabId = "adr" | "contributing" | "setup" | "issues" | "mentor" | "security";

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "#ff4444", MEDIUM: "#f5a623", LOW: "#44ff88",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#44ff88", medium: "#f5a623", hard: "#ff4444",
};

function SecurityTab({ findings }: { findings: SecurityFinding[] }) {
  if (findings.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#44ff88" }}>
          No security findings detected
        </div>
      </div>
    );
  }

  const byGroup = findings.reduce<Record<string, SecurityFinding[]>>((acc, f) => {
    acc[f.severity] = [...(acc[f.severity] ?? []), f];
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {(["HIGH", "MEDIUM", "LOW"] as const).map((sev) =>
        (byGroup[sev] ?? []).map((f, i) => {
          const col = SEVERITY_COLOR[sev];
          return (
            <div key={`${sev}-${i}`} style={{ borderLeft: `2px solid ${col}`, border: `1px solid ${col}20`, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: col }}>
                  {sev}
                </span>
                <span style={{ fontSize: 11, color: "#444444", fontFamily: "monospace" }}>
                  {f.file}{f.line != null ? `:${f.line}` : ""}
                </span>
              </div>
              <p style={{ fontSize: 14, color: "#ffffff", marginBottom: 10, fontWeight: 500, letterSpacing: "-0.01em" }}>
                {f.issue}
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#f5a623", fontSize: 11, marginTop: 1, flexShrink: 0 }}>→</span>
                <p style={{ fontSize: 12, color: "#666666", margin: 0, lineHeight: 1.6 }}>
                  {f.recommendation}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function IssuesTab({ issues }: { issues: FirstGoodIssue[] }) {
  if (issues.length === 0) {
    return (
      <p style={{ fontSize: 11, color: "#333333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        No starter issues generated.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {issues.map((issue, i) => {
        const col = DIFFICULTY_COLOR[issue.difficulty] ?? "#44ff88";
        return (
          <div key={i} style={{ border: "1px solid #1a1a1a", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#1a1a1a", lineHeight: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>
                  {issue.title}
                </h3>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: col, flexShrink: 0 }}>
                {issue.difficulty}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#666666", lineHeight: 1.7, marginBottom: 14 }}>
              {issue.description}
            </p>
            {issue.acceptance_criteria.length > 0 && (
              <div>
                <p style={{ fontSize: 9, color: "#333333", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
                  Acceptance criteria
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {issue.acceptance_criteria.map((c, j) => (
                    <li key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#44ff88", fontSize: 11, marginTop: 1, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: "#666666" }}>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MentorTab({
  feedback,
  score,
  debateMessages,
}: {
  feedback: MentorFeedback[];
  score: { questions: number; corrections: number };
  debateMessages: { agent: string; output_type: string; content: string; timestamp: string }[];
}) {
  const questions = feedback.filter((f) => f.type === "question");
  const corrections = feedback.filter((f) => f.type === "correction");
  const total = score.questions + score.corrections;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {[
          { label: "Questions", value: score.questions, color: "#ffffff" },
          { label: "Corrections", value: score.corrections, color: "#f5a623" },
          ...(total > 0 ? [{ label: "Total insights", value: total, color: "#999999" }] : []),
        ].map((s) => (
          <div key={s.label} style={{ border: "1px solid #1a1a1a", padding: "20px 28px", flex: 1 }}>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 6 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444444" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
            Socratic questions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ border: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ color: "#f5a623", fontSize: 16, fontWeight: 900, flexShrink: 0, lineHeight: 1.4 }}>?</span>
                <p style={{ fontSize: 14, color: "#cccccc", lineHeight: 1.7, margin: 0 }}>{q.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {corrections.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
            Corrections
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {corrections.map((c, i) => (
              <div key={i} style={{ border: "1px solid #f5a62320", borderLeft: "2px solid #f5a623", padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ color: "#f5a623", fontSize: 13, fontWeight: 900, flexShrink: 0, lineHeight: 1.5 }}>!</span>
                <p style={{ fontSize: 14, color: "#cccccc", lineHeight: 1.7, margin: 0 }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {debateMessages.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
            Agent debate
          </p>
          <div style={{ border: "1px solid #1a1a1a" }}>
            <div style={{ borderBottom: "1px solid #1a1a1a", padding: "10px 16px", background: "#0f0f0f" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#f5a623" }}>
                Mentor ↔ Architect
              </span>
            </div>
            {debateMessages.map((m, i) => (
              <div key={i} style={{ padding: 16, borderBottom: i < debateMessages.length - 1 ? "1px solid #1a1a1a" : "none" }}>
                <div style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                  {m.agent} · {m.output_type}
                </div>
                <MarkdownViewer content={m.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.length === 0 && debateMessages.length === 0 && (
        <p style={{ fontSize: 11, color: "#333333", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          No mentor feedback available.
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes skShimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .sk { background: #111111; overflow: hidden; position: relative; }
        .sk::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent); animation:skShimmer 1.6s infinite; }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="sk" style={{ height: 20, width: 320 }} />
        <div className="sk" style={{ height: 12, width: 200 }} />
        <div style={{ display: "flex", gap: 1, marginTop: 8 }}>
          {[80, 130, 80, 70, 90, 90].map((w, i) => (
            <div key={i} className="sk" style={{ height: 34, width: w }} />
          ))}
        </div>
        <div className="sk" style={{ height: 400, marginTop: 8 }} />
      </div>
    </>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2 || data.every((d) => d === 0)) return null;
  const max = Math.max(...data, 1);
  const W = 80, H = 20;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * (H - 4) - 2,
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={area} fill="rgba(245,166,35,0.08)" />
      <path d={line} fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("adr");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sparklineData, setSparklineData] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!report?.repo_url) return;
    const m = report.repo_url.match(/github\.com\/([^/\s?#]+\/[^/\s?#]+)/);
    if (!m) return;
    const path = m[1].replace(".git", "");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    fetch(`https://api.github.com/repos/${path}/commits?per_page=100&since=${since}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((commits: unknown[]) => {
        if (!Array.isArray(commits)) return;
        const counts = new Array(30).fill(0);
        const now = Date.now();
        for (const c of commits) {
          const date = (c as { commit?: { author?: { date?: string } } }).commit?.author?.date;
          if (!date) continue;
          const daysAgo = Math.floor((now - new Date(date).getTime()) / 86400000);
          if (daysAgo >= 0 && daysAgo < 30) counts[29 - daysAgo]++;
        }
        setSparklineData(counts);
      })
      .catch(() => {});
  }, [report?.repo_url]);

  const fetchReport = useCallback(async () => {
    try {
      const data = await api.getReport(sessionId);
      setReport(data);
      setLoading(false);
      setPolling(false);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.status === 202) { setPolling(true); setLoading(false); return; }
      if (err.status === 401) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      setError(err.message ?? "Failed to load report");
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    if (!getAuthToken()) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    fetchReport();
  }, [fetchReport, router]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchReport, 3000);
    return () => clearInterval(id);
  }, [polling, fetchReport]);

  const handleCopyShare = async () => {
    if (!report?.share_token) return;
    const url = `${window.location.origin}/r/${report.share_token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!sessionId) return;
    setDownloading(true);
    try { await api.downloadReport(sessionId); } catch { /* ignore */ } finally { setDownloading(false); }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = report
    ? [
        { id: "adr", label: "ADR.md" },
        { id: "contributing", label: "CONTRIBUTING" },
        ...(report.setup_walkthrough ? [{ id: "setup" as TabId, label: "Setup" }] : []),
        { id: "issues", label: "Issues", count: report.first_good_issues.length },
        { id: "mentor", label: "Mentor", count: report.mentor_feedback.length },
        { id: "security", label: "Security", count: report.security_findings.length },
      ]
    : [];

  const showSkeleton = loading || !minDelayDone;
  const debateMessages = (report?.band_thread ?? []).filter((m) => m.output_type === "DEBATE");
  const hasHumanReview = (report?.human_review_flags ?? []).length > 0;
  const repoName = report?.repo_url.replace("https://github.com/", "") ?? sessionId;

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .rp-root { min-height: 100vh; background: #0a0a0a; color: #ffffff; font-family: 'Inter', sans-serif; }
        .rp-nav {
          height: 52px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: stretch;
          position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #0a0a0a;
        }
        .rp-nav-logo {
          display: flex; align-items: center; padding: 0 24px; border-right: 1px solid #1a1a1a;
          font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;
          letter-spacing: -0.02em; text-transform: uppercase; flex-shrink: 0;
        }
        .rp-nav-repo {
          flex: 1; display: flex; align-items: center; padding: 0 20px;
          font-size: 11px; color: #333333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rp-nav-actions { display: flex; align-items: stretch; border-left: 1px solid #1a1a1a; }
        .rp-nav-btn {
          display: flex; align-items: center; padding: 0 18px; border: none; border-right: 1px solid #1a1a1a;
          cursor: pointer; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; transition: background 0.15s; background: transparent;
        }
        .rp-nav-btn.ghost { color: #555555; }
        .rp-nav-btn.ghost:hover { background: #111111; color: #ffffff; }
        .rp-nav-btn.primary { background: #ffffff; color: #0a0a0a; }
        .rp-nav-btn.primary:hover { background: #f5a623; }
        .rp-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rp-body { max-width: 1100px; margin: 0 auto; padding: 72px 0 60px; }
        .rp-header { padding: 32px 24px 0; }
        .rp-title-row { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
        .rp-title { font-size: 28px; font-weight: 900; letter-spacing: -0.04em; }
        .rp-meta { font-size: 10px; color: #444444; letter-spacing: 0.1em; text-transform: uppercase; }
        .rp-review-banner {
          border: 1px solid #f5a62330; border-left: 2px solid #f5a623;
          padding: 12px 16px; margin: 20px 24px 0; display: flex; align-items: center; gap: 10px;
        }
        .rp-review-text { font-size: 12px; color: #f5a623; }
        .rp-tabs {
          display: flex; border-bottom: 1px solid #1a1a1a; margin-top: 28px;
          overflow-x: auto; padding: 0 24px;
        }
        .rp-tab {
          display: flex; align-items: center; gap: 7px; padding: 12px 14px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: #444444; cursor: pointer; border: none; background: none;
          border-bottom: 2px solid transparent; white-space: nowrap;
          font-family: 'Inter', sans-serif; transition: color 0.15s, border-color 0.15s;
          margin-bottom: -1px;
        }
        .rp-tab:hover { color: #888888; }
        .rp-tab.active { color: #ffffff; border-bottom-color: #f5a623; }
        .rp-tab-count {
          font-size: 9px; color: #333333; padding: 1px 5px; border: 1px solid #222222;
        }
        .rp-content { padding: 32px 24px; min-height: 300px; }
        .rp-poll { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 80px 20px; }
        .rp-poll-ring { width: 32px; height: 32px; border: 1px solid #222222; border-top-color: #f5a623; border-radius: 50%; animation: rpspin 0.9s linear infinite; }
        .rp-poll-text { font-size: 10px; color: #333333; letter-spacing: 0.12em; text-transform: uppercase; }
        @keyframes rpspin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="rp-root">
        <nav className="rp-nav">
          <Link href="/" className="rp-nav-logo">DM/Band</Link>
          <span className="rp-nav-repo">{report?.repo_url ?? sessionId}</span>
          <div className="rp-nav-actions">
            {report?.share_token && (
              <button onClick={handleCopyShare} className="rp-nav-btn ghost">
                {copied ? "✓ Copied" : "Share"}
              </button>
            )}
            {report && (
              <button onClick={handleDownload} disabled={downloading} className="rp-nav-btn primary">
                {downloading ? "Saving…" : "Download ZIP"}
              </button>
            )}
          </div>
        </nav>

        <div className="rp-body">
          {showSkeleton && (
            <div style={{ padding: "32px 24px" }}>
              <Skeleton />
            </div>
          )}

          {polling && !showSkeleton && (
            <div className="rp-poll">
              <div className="rp-poll-ring" />
              <p className="rp-poll-text">Analysis in progress — waiting for agents…</p>
            </div>
          )}

          {error && (
            <div style={{ padding: "32px 24px" }}>
              <div style={{ border: "1px solid #ff444430", padding: "20px 24px" }}>
                <p style={{ color: "#ff4444", fontSize: 14 }}>{error}</p>
                <Link href="/" style={{ color: "#ffffff", fontSize: 12, display: "inline-block", marginTop: 10 }}>← Back to home</Link>
              </div>
            </div>
          )}

          {report && !showSkeleton && !polling && (
            <>
              <div className="rp-header">
                <div className="rp-title-row">
                  <h1 className="rp-title">{repoName}</h1>
                  {sparklineData.length > 0 && (
                    <div title="Commit activity — last 30 days">
                      <Sparkline data={sparklineData} />
                    </div>
                  )}
                </div>
                <p className="rp-meta">
                  Analysis complete · {report.security_findings.length} finding{report.security_findings.length !== 1 ? "s" : ""} · {report.first_good_issues.length} starter issue{report.first_good_issues.length !== 1 ? "s" : ""}
                </p>
              </div>

              {hasHumanReview && (
                <div className="rp-review-banner">
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <span className="rp-review-text">Human review recommended — one or more agents flagged low-confidence findings.</span>
                </div>
              )}

              <div className="rp-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`rp-tab${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="rp-tab-count">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rp-content">
                {activeTab === "adr" && <MarkdownViewer content={report.adr} />}
                {activeTab === "contributing" && <MarkdownViewer content={report.contributing} />}
                {activeTab === "setup" && <MarkdownViewer content={report.setup_walkthrough ?? ""} />}
                {activeTab === "issues" && <IssuesTab issues={report.first_good_issues} />}
                {activeTab === "mentor" && (
                  <MentorTab
                    feedback={report.mentor_feedback}
                    score={report.socratic_score}
                    debateMessages={debateMessages}
                  />
                )}
                {activeTab === "security" && <SecurityTab findings={report.security_findings} />}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
