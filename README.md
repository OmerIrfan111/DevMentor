# DevMentor Band 🤖

> AI-powered code mentorship — submit a GitHub repo, get a full senior-level engineering review in seconds.

Built for the **Band of Agents Hackathon 2026** · Tracks 1 & 2

---

## What It Does

Paste any public GitHub repo URL. Four specialised AI agents collaborate through a shared Band room to analyse your codebase and deliver a comprehensive report:

| Agent | Output |
|---|---|
| 🔐 **Security** | Vulnerability scan, secrets detection, insecure patterns |
| 🏗️ **Architect** | Architecture Decision Record (ADR), design recommendations |
| 📦 **Onboarding** | `CONTRIBUTING.md`, step-by-step setup walkthrough |
| 🧠 **Mentor** | Socratic feedback, tech debt highlights, debate mode |

Reports are downloadable as a ZIP and shareable via a public link — no login required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, MongoDB Atlas, JWT Auth |
| AI / Agents | AIML API (DeepSeek v4), Band SDK (multi-agent) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Real-time | Server-Sent Events (SSE) |
| Infra | Docker Compose, Render, Vercel |

---

## Running Locally

**Backend**
```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI, AIMLAPI_KEY, BAND_API_KEY
python dev_server.py   # http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

---

## Key Features

- ⚡ Live streaming analysis via SSE — watch agents work in real time
- 📁 Download full report as ZIP (ADR.md, CONTRIBUTING.md, SETUP.md, issues)
- 🔗 Public shareable report links
- 🧠 Agent DEBATE mode — Mentor can challenge Architect's decisions
- 🚀 Repo-level caching — same repo skips re-analysis (12h TTL)
- ⚠️ Human review flag when agent confidence < 70%

---

## Team

Built by **Omer Irfan** & **Musa Nadeem**