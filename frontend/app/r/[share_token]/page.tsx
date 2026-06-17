"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Report, type SecurityFinding, type MentorFeedback, type FirstGoodIssue } from "@/lib/api";
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
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: col }}>{sev}</span>
                <span style={{ fontSize: 11, color: "#444444", fontFamily: "monospace" }}>{f.file}{f.line != null ? `:${f.line}` : ""}</span>
              </div>
              <p style={{ fontSize: 14, color: "#ffffff", marginBottom: 10, fontWeight: 500, letterSpacing: "-0.01em" }}>{f.issue}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#f5a623", fontSize: 11, marginTop: 1, flexShrink: 0 }}>→</span>
                <p style={{ fontSize: 12, color: "#666666", margin: 0, lineHeight: 1.6 }}>{f.recommendation}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function IssuesTab({ issues }: { issues: FirstGoodIssue[] }) {
  if (issues.length === 0) return <p style={{ fontSize: 11, color: "#333333", letterSpacing: "0.08em", textTransform: "uppercase" }}>No starter issues generated.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {issues.map((issue, i) => {
        const col = DIFFICULTY_COLOR[issue.difficulty] ?? "#44ff88";
        return (
          <div key={i} style={{ border: "1px solid #1a1a1a", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#1a1a1a", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>{issue.title}</h3>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: col, flexShrink: 0 }}>{issue.difficulty}</span>
            </div>
            <p style={{ fontSize: 13, color: "#666666", lineHeight: 1.7, marginBottom: 14 }}>{issue.description}</p>
            {issue.acceptance_criteria.length > 0 && (
              <div>
                <p style={{ fontSize: 9, color: "#333333", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Acceptance criteria</p>
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

function MentorTab({ feedback, score }: { feedback: MentorFeedback[]; score: { questions: number; corrections: number } }) {
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
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em", color: s.color, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#444444" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {questions.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>Socratic questions</p>
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
          <p style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>Corrections</p>
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
      {feedback.length === 0 && <p style={{ fontSize: 11, color: "#333333", letterSpacing: "0.08em", textTransform: "uppercase" }}>No mentor feedback available.</p>}
    </div>
  );
}

export default function PublicReportPage() {
  const params = useParams();
  const shareToken = params?.share_token as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("adr");

  useEffect(() => {
    if (!shareToken) return;
    api.getPublicReport(shareToken)
      .then((data) => { setReport(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message ?? "Report not found"); setLoading(false); });
  }, [shareToken]);

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

  const repoName = report?.repo_url.replace("https://github.com/", "") ?? "";

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .pub-root { min-height: 100vh; background: #0a0a0a; color: #ffffff; font-family: 'Inter', sans-serif; }
        .pub-nav {
          height: 52px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: stretch;
          position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #0a0a0a;
        }
        .pub-nav-logo {
          display: flex; align-items: center; padding: 0 24px; border-right: 1px solid #1a1a1a;
          font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;
          letter-spacing: -0.02em; text-transform: uppercase; flex-shrink: 0;
        }
        .pub-badge {
          display: flex; align-items: center; padding: 0 16px; border-right: 1px solid #1a1a1a;
          font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #f5a623;
        }
        .pub-nav-repo {
          flex: 1; display: flex; align-items: center; padding: 0 20px;
          font-size: 11px; color: #333333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pub-cta {
          display: flex; align-items: center; padding: 0 20px; border-left: 1px solid #1a1a1a;
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #0a0a0a; background: #ffffff; text-decoration: none; flex-shrink: 0;
          transition: background 0.15s;
        }
        .pub-cta:hover { background: #f5a623; }
        .pub-body { max-width: 1100px; margin: 0 auto; padding: 72px 0 60px; }
        .pub-header { padding: 32px 24px 0; }
        .pub-title { font-size: 28px; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 6px; }
        .pub-meta { font-size: 10px; color: #444444; letter-spacing: 0.1em; text-transform: uppercase; }
        .pub-tabs {
          display: flex; border-bottom: 1px solid #1a1a1a; margin-top: 28px;
          overflow-x: auto; padding: 0 24px;
        }
        .pub-tab {
          display: flex; align-items: center; gap: 7px; padding: 12px 14px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: #444444; cursor: pointer; border: none; background: none;
          border-bottom: 2px solid transparent; white-space: nowrap;
          font-family: 'Inter', sans-serif; transition: color 0.15s, border-color 0.15s;
          margin-bottom: -1px;
        }
        .pub-tab:hover { color: #888888; }
        .pub-tab.active { color: #ffffff; border-bottom-color: #f5a623; }
        .pub-tab-count { font-size: 9px; color: #333333; padding: 1px 5px; border: 1px solid #222222; }
        .pub-content { padding: 32px 24px; min-height: 300px; }
        .pub-cta-strip {
          margin: 40px 24px 0; border: 1px solid #1a1a1a;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          flex-wrap: wrap;
        }
        .pub-cta-strip-left { padding: 20px 24px; }
        .pub-cta-strip-title { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
        .pub-cta-strip-sub { font-size: 11px; color: #555555; }
        .pub-cta-strip-btn {
          display: flex; align-items: center; align-self: stretch; padding: 0 24px;
          border-left: 1px solid #1a1a1a; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #0a0a0a; background: #ffffff; text-decoration: none;
          flex-shrink: 0; white-space: nowrap; transition: background 0.15s;
        }
        .pub-cta-strip-btn:hover { background: #f5a623; }
        @keyframes pubspin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="pub-root">
        <nav className="pub-nav">
          <Link href="/" className="pub-nav-logo">DM/Band</Link>
          <span className="pub-badge">Public</span>
          <span className="pub-nav-repo">{report?.repo_url ?? ""}</span>
          <Link href="/register" className="pub-cta">Try it free →</Link>
        </nav>

        <div className="pub-body">
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>
              <div style={{ width: 32, height: 32, border: "1px solid #222222", borderTopColor: "#f5a623", borderRadius: "50%", animation: "pubspin 0.9s linear infinite" }} />
            </div>
          )}

          {error && (
            <div style={{ padding: "32px 24px" }}>
              <div style={{ border: "1px solid #ff444430", padding: "24px", textAlign: "center" }}>
                <p style={{ color: "#ff4444", fontSize: 14, marginBottom: 12 }}>{error}</p>
                <Link href="/" style={{ color: "#ffffff", fontSize: 12 }}>← Back to home</Link>
              </div>
            </div>
          )}

          {report && !loading && (
            <>
              <div className="pub-header">
                <h1 className="pub-title">{repoName}</h1>
                <p className="pub-meta">
                  {report.security_findings.length} finding{report.security_findings.length !== 1 ? "s" : ""} · {report.first_good_issues.length} starter issue{report.first_good_issues.length !== 1 ? "s" : ""} · read-only shared view
                </p>
              </div>

              <div className="pub-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`pub-tab${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined && <span className="pub-tab-count">{tab.count}</span>}
                  </button>
                ))}
              </div>

              <div className="pub-content">
                {activeTab === "adr" && <MarkdownViewer content={report.adr} />}
                {activeTab === "contributing" && <MarkdownViewer content={report.contributing} />}
                {activeTab === "setup" && <MarkdownViewer content={report.setup_walkthrough ?? ""} />}
                {activeTab === "issues" && <IssuesTab issues={report.first_good_issues} />}
                {activeTab === "mentor" && <MentorTab feedback={report.mentor_feedback} score={report.socratic_score} />}
                {activeTab === "security" && <SecurityTab findings={report.security_findings} />}
              </div>

              <div className="pub-cta-strip">
                <div className="pub-cta-strip-left">
                  <p className="pub-cta-strip-title">Get AI mentorship for your own repo</p>
                  <p className="pub-cta-strip-sub">Security · Architecture · Onboarding · Socratic feedback — in under 90 seconds.</p>
                </div>
                <Link href="/register" className="pub-cta-strip-btn">
                  Analyse your repo →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
