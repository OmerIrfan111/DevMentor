const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const error = new Error(err.detail ?? "Request failed") as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserOut {
  id: string;
  email: string;
  name: string;
}

// ── Report types ───────────────────────────────────────────

export interface SecurityFinding {
  severity: "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line?: number;
  issue: string;
  recommendation: string;
}

export interface MentorFeedback {
  type: "question" | "correction";
  text: string;
}

export interface FirstGoodIssue {
  title: string;
  description: string;
  acceptance_criteria: string[];
  difficulty: "easy" | "medium" | "hard";
}

export interface BandThreadMessage {
  agent: string;
  message_id: string;
  output_type: string;
  content: string;
  timestamp: string;
}

export interface SocraticScore {
  questions: number;
  corrections: number;
}

export interface Report {
  session_id: string;
  repo_url: string;
  band_room_id?: string;
  adr: string;
  contributing: string;
  first_good_issues: FirstGoodIssue[];
  mentor_feedback: MentorFeedback[];
  security_findings: SecurityFinding[];
  band_thread: BandThreadMessage[];
  human_review_flags: Record<string, unknown>[];
  socratic_score: SocraticScore;
  share_token?: string;
}

// ── API client ─────────────────────────────────────────────

export const api = {
  register: (body: RegisterPayload) =>
    request<UserOut>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: LoginPayload) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  health: () => request<{ status: string }>("/health"),

  getReport: (sessionId: string) =>
    request<Report>(`/reports/${sessionId}`, {}, true),

  getPublicReport: (shareToken: string) =>
    request<Report>(`/r/${shareToken}`),

  downloadReport: async (sessionId: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/reports/${sessionId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devmentor-${sessionId.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
