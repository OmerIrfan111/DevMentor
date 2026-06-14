"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Report, type SecurityFinding, type MentorFeedback, type FirstGoodIssue } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import MarkdownViewer from "@/components/MarkdownViewer";

// ── Types ──────────────────────────────────────────────────

type TabId = "adr" | "contributing" | "issues" | "mentor" | "security";

// ── Severity helpers ────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  HIGH:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  MEDIUM: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24" },
  LOW:    { bg: "rgba(34,197,94,0.12)",   color: "#4ade80" },
};

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string }> = {
  easy:   { bg: "rgba(34,197,94,0.12)",   color: "#4ade80" },
  medium: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24" },
  hard:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
};

// ── Tab content components ──────────────────────────────────

function SecurityTab({ findings }: { findings: SecurityFinding[] }) {
  if (findings.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: "28px", marginBottom: "10px" }}>✓</div>
        <p style={{ color: "#4ade80", fontFamily: "'Space Mono', monospace", fontSize: "13px" }}>
          No security findings detected.
        </p>
      </div>
    );
  }

  const byGroup = findings.reduce<Record<string, SecurityFinding[]>>((acc, f) => {
    acc[f.severity] = [...(acc[f.severity] ?? []), f];
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {(["HIGH", "MEDIUM", "LOW"] as const).map((sev) =>
        (byGroup[sev] ?? []).map((f, i) => {
          const s = SEVERITY_STYLE[sev];
          return (
            <div key={`${sev}-${i}`} style={{ background: "#0e0e17", border: `1px solid ${s.color}30`, borderRadius: "10px", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ background: s.bg, color: s.color, fontFamily: "'Space Mono', monospace", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.06em" }}>
                  {sev}
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "#6668a0" }}>
                  {f.file}{f.line != null ? `:${f.line}` : ""}
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "#c8ccee", marginBottom: "10px", fontWeight: 500 }}>
                {f.issue}
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ color: "#4361ee", fontFamily: "'Space Mono', monospace", fontSize: "11px", marginTop: "1px", flexShrink: 0 }}>→</span>
                <p style={{ fontSize: "13px", color: "#8890c0", margin: 0, lineHeight: "1.6" }}>
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
      <p style={{ color: "#44446a", fontFamily: "'Space Mono', monospace", fontSize: "13px" }}>
        No starter issues generated.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {issues.map((issue, i) => {
        const diff = DIFFICULTY_STYLE[issue.difficulty] ?? DIFFICULTY_STYLE.easy;
        return (
          <div key={i} style={{ background: "#0e0e17", border: "1px solid #1c1c2e", borderRadius: "10px", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "#44446a" }}>
                  #{i + 1}
                </span>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#c8ccee", margin: 0 }}>
                  {issue.title}
                </h3>
              </div>
              <span style={{ background: diff.bg, color: diff.color, fontFamily: "'Space Mono', monospace", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.06em", flexShrink: 0 }}>
                {issue.difficulty.toUpperCase()}
              </span>
            </div>

            <p style={{ fontSize: "13px", color: "#8890c0", lineHeight: "1.7", marginBottom: "14px" }}>
              {issue.description}
            </p>

            {issue.acceptance_criteria.length > 0 && (
              <div>
                <p style={{ fontSize: "11px", color: "#44446a", fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "8px" }}>
                  ACCEPTANCE CRITERIA
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "5px" }}>
                  {issue.acceptance_criteria.map((c, j) => (
                    <li key={j} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: "#22c55e", fontSize: "12px", marginTop: "1px", flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: "13px", color: "#7880b0" }}>{c}</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Socratic Score */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: "10px", padding: "16px 24px", minWidth: "140px" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#a855f7", marginBottom: "4px" }}>
            {score.questions}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#6668a0", letterSpacing: "0.08em" }}>
            QUESTIONS
          </div>
        </div>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "16px 24px", minWidth: "140px" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>
            {score.corrections}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#6668a0", letterSpacing: "0.08em" }}>
            CORRECTIONS
          </div>
        </div>
        {total > 0 && (
          <div style={{ background: "rgba(67,97,238,0.08)", border: "1px solid rgba(67,97,238,0.2)", borderRadius: "10px", padding: "16px 24px", minWidth: "140px" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#4361ee", marginBottom: "4px" }}>
              {total}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#6668a0", letterSpacing: "0.08em" }}>
              TOTAL INSIGHTS
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "#44446a", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
            SOCRATIC QUESTIONS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {questions.map((q, i) => (
              <div key={i} style={{ background: "#0e0e17", border: "1px solid #1c1c2e", borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ color: "#a855f7", fontFamily: "'Space Mono', monospace", fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>?</span>
                <p style={{ fontSize: "14px", color: "#a0a8d0", lineHeight: "1.7", margin: 0 }}>{q.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <div>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "#44446a", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
            CORRECTIONS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {corrections.map((c, i) => (
              <div key={i} style={{ background: "#0e0e17", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ color: "#f59e0b", fontFamily: "'Space Mono', monospace", fontSize: "13px", marginTop: "1px", flexShrink: 0 }}>!</span>
                <p style={{ fontSize: "14px", color: "#a0a8d0", lineHeight: "1.7", margin: 0 }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Debate */}
      {debateMessages.length > 0 && (
        <div>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "#44446a", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
            AGENT DEBATE
          </p>
          <div style={{ border: "1px solid rgba(67,97,238,0.2)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ background: "rgba(67,97,238,0.06)", padding: "10px 16px", borderBottom: "1px solid rgba(67,97,238,0.2)" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#4361ee", letterSpacing: "0.08em" }}>
                MENTOR ↔ ARCHITECT
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {debateMessages.map((m, i) => (
                <div key={i} style={{ padding: "16px", borderBottom: i < debateMessages.length - 1 ? "1px solid #1c1c2e" : "none" }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#44446a", marginBottom: "6px", textTransform: "uppercase" }}>
                    {m.agent} · {m.output_type}
                  </div>
                  <MarkdownViewer content={m.content} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedback.length === 0 && debateMessages.length === 0 && (
        <p style={{ color: "#44446a", fontFamily: "'Space Mono', monospace", fontSize: "13px" }}>
          No mentor feedback available.
        </p>
      )}
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────

function Skeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmerSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .sk { background: #0e0e17; border-radius: 6px; overflow: hidden; position: relative; }
        .sk::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(67,97,238,0.06),transparent); animation:shimmerSlide 1.6s infinite; }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="sk" style={{ height: "20px", width: "340px" }} />
        <div className="sk" style={{ height: "14px", width: "220px" }} />
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          {[80, 130, 80, 70, 90].map((w, i) => (
            <div key={i} className="sk" style={{ height: "32px", width: `${w}px` }} />
          ))}
        </div>
        <div className="sk" style={{ height: "400px", marginTop: "8px" }} />
      </div>
    </>
  );
}

// ── Main page ───────────────────────────────────────────────

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("adr");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const data = await api.getReport(sessionId);
      setReport(data);
      setLoading(false);
      setPolling(false);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.status === 202) {
        setPolling(true);
        setLoading(false);
        return;
      }
      if (err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
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
    try {
      await api.downloadReport(sessionId);
    } catch {
      // silently ignore download errors
    } finally {
      setDownloading(false);
    }
  };

  const tabs: { id: TabId; label: string; agentColor: string; count?: number }[] = report
    ? [
        { id: "adr",          label: "ADR.md",          agentColor: "#4361ee" },
        { id: "contributing", label: "CONTRIBUTING.md", agentColor: "#06b6d4" },
        { id: "issues",       label: "Issues",          agentColor: "#06b6d4", count: report.first_good_issues.length },
        { id: "mentor",       label: "Mentor",          agentColor: "#a855f7", count: report.mentor_feedback.length },
        { id: "security",     label: "Security",        agentColor: "#f59e0b", count: report.security_findings.length },
      ]
    : [];

  const debateMessages = (report?.band_thread ?? []).filter((m) => m.output_type === "DEBATE");
  const hasHumanReview = (report?.human_review_flags ?? []).length > 0;
  const repoName = report?.repo_url.replace("https://github.com/", "") ?? sessionId;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
        .rp-root { min-height: 100vh; background: #0a0a10; color: #dde0f0; font-family: 'DM Sans', sans-serif; }
        .rp-header-inner { display: flex; align-items: center; gap: 14px; padding: 16px 32px; max-width: 1100px; margin: 0 auto; }
        .rp-logo { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; color: #4361ee; text-decoration: none; flex-shrink: 0; }
        .rp-repo { font-family: 'Space Mono', monospace; font-size: 11px; color: #44446a; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rp-body { max-width: 1100px; margin: 0 auto; padding: 32px 32px 60px; }
        .rp-page-title { margin-bottom: 24px; }
        .rp-page-title h1 { font-size: 20px; font-weight: 700; color: #c8ccee; margin-bottom: 4px; }
        .rp-page-title p { font-family: 'Space Mono', monospace; font-size: 11px; color: #44446a; margin: 0; }
        .rp-review-banner { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .rp-review-text { font-size: 13px; color: #fbbf24; }
        .rp-tabs { display: flex; gap: 0; border-bottom: 1px solid #1c1c2e; margin-bottom: 28px; overflow-x: auto; }
        .rp-tab { display: flex; align-items: center; gap: 7px; padding: 10px 16px; font-size: 12px; color: #44446a; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; transition: color 0.15s, border-color 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: 'Space Mono', monospace; }
        .rp-tab:hover { color: #8890c0; }
        .rp-tab.active { color: #c8ccee; border-bottom-color: var(--tc); }
        .rp-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tc); flex-shrink: 0; }
        .rp-tab-count { background: #1c1c2e; color: #6668a0; font-size: 10px; padding: 1px 6px; border-radius: 10px; }
        .rp-content { min-height: 300px; }
        .rp-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 7px; font-size: 11px; font-family: 'Space Mono', monospace; font-weight: 700; cursor: pointer; border: 1px solid; transition: opacity 0.15s; letter-spacing: 0.02em; }
        .rp-btn:hover:not(:disabled) { opacity: 0.75; }
        .rp-btn:disabled { cursor: not-allowed; opacity: 0.5; }
        .rp-btn-primary { background: rgba(67,97,238,0.12); color: #4361ee; border-color: rgba(67,97,238,0.3); }
        .rp-btn-ghost { background: transparent; color: #6668a0; border-color: #1c1c2e; }
        .rp-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .rp-poll { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 80px 20px; }
        .rp-poll-ring { width: 36px; height: 36px; border: 2px solid #1c1c2e; border-top-color: #4361ee; border-radius: 50%; animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="rp-root">
        {/* Header */}
        <header style={{ borderBottom: "1px solid #1c1c2e" }}>
          <div className="rp-header-inner">
            <Link href="/" className="rp-logo">DM/Band</Link>
            <span className="rp-repo">{report?.repo_url ?? sessionId}</span>
            <div className="rp-actions">
              {report?.share_token && (
                <button onClick={handleCopyShare} className="rp-btn rp-btn-ghost">
                  {copied ? "✓ Copied!" : "Share"}
                </button>
              )}
              {report && (
                <button onClick={handleDownload} disabled={downloading} className="rp-btn rp-btn-primary">
                  {downloading ? "Saving…" : "Download ZIP"}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="rp-body">
          {loading && <Skeleton />}

          {polling && !loading && (
            <div className="rp-poll">
              <div className="rp-poll-ring" />
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "#44446a" }}>
                Analysis in progress — waiting for agents…
              </p>
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "20px 24px" }}>
              <p style={{ color: "#f87171", fontSize: "14px", margin: 0 }}>{error}</p>
              <Link href="/" style={{ color: "#4361ee", fontSize: "13px", display: "inline-block", marginTop: "10px" }}>
                ← Back to home
              </Link>
            </div>
          )}

          {report && !loading && !polling && (
            <>
              <div className="rp-page-title">
                <h1>{repoName}</h1>
                <p>
                  Analysis complete ·{" "}
                  {report.security_findings.length} finding{report.security_findings.length !== 1 ? "s" : ""} ·{" "}
                  {report.first_good_issues.length} starter issue{report.first_good_issues.length !== 1 ? "s" : ""}
                </p>
              </div>

              {hasHumanReview && (
                <div className="rp-review-banner">
                  <span style={{ fontSize: "16px" }}>⚠</span>
                  <span className="rp-review-text">
                    Human review recommended — one or more agents flagged low-confidence findings.
                  </span>
                </div>
              )}

              <div className="rp-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`rp-tab${activeTab === tab.id ? " active" : ""}`}
                    style={{ "--tc": tab.agentColor } as React.CSSProperties}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="rp-tab-dot" />
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
