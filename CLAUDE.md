# DevMentor Band — Claude Context

## Project
DevMentor Band democratises senior-level code mentorship. Users submit a GitHub repo URL; four specialised AI agents (Security, Architect, Onboarding, Mentor) collaborate through Band's shared interaction layer to produce an ADR, CONTRIBUTING.md, onboarding package, and Socratic feedback.

**Hackathon:** Band of Agents Hackathon 2026
**Tracks:** Track 1 (Internal Enterprise Workflows) · Track 2 (Multi-Agent Software Development)
**Team:** Omer Irfan · Musa Nadeem

## Architecture
- One Band room created per analysis session — agents chain by calling `band.get_room_messages()` before posting
- Pipeline: Security → Architect → Onboarding → Mentor (each reads all prior Band messages)
- Mentor may post a `DEBATE`-typed message if it disagrees with Architect, referencing the Architect's Band message ID
- `needs_human_review: true` on any message with `confidence < 0.7`

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | FastAPI, Motor (async MongoDB), python-jose JWT, bcrypt, pydantic-settings |
| Task queue | Celery + Redis |
| AI | AIML API (deepseek/deepseek-v4-flash) via OpenAI-compatible client |
| Agent comms | Band SDK (band.create_room, band.post_message, band.get_room_messages) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Infra | Docker Compose, MongoDB Atlas (prod), Upstash Redis (prod) |
| Deploy | Render (backend + celery worker), Vercel (frontend) |

## Repository Structure
```
devmentor-band/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entry, CORS, lifespan
│   │   ├── config.py             # pydantic-settings env config
│   │   ├── database.py           # Motor MongoDB client
│   │   ├── models/               # Pydantic models: User, Session, Report
│   │   ├── auth/                 # router.py, jwt.py, hash.py
│   │   ├── agents/               # base.py, security.py, architect.py, onboarding.py, mentor.py
│   │   ├── band/                 # client.py, session.py
│   │   ├── orchestrator/         # pipeline.py (SSE), tasks.py (Celery)
│   │   └── routers/              # analyze.py, reports.py
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Landing: repo URL input + agent explainer
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── analyze/page.tsx      # Live SSE progress (Phase 2)
│   │   └── report/[id]/page.tsx  # Full report tabs (Phase 3)
│   ├── components/               # AgentCard, BandRoomViewer, ReportTabs, SocraticScore
│   ├── lib/
│   │   ├── api.ts                # Typed fetch wrapper
│   │   └── auth.ts               # Cookie-based JWT helpers
│   └── tailwind.config.ts
├── docker-compose.yml
├── .gitignore
└── CLAUDE.md
```

## Band Message Schema
Every agent posts structured JSON to the Band room:
```json
{
  "agent_name":         "architect | onboarding | security | mentor",
  "output_type":        "ADR | CONTRIBUTING | SECURITY | FEEDBACK | DEBATE",
  "content":            "<markdown string>",
  "confidence":         0.0,
  "needs_human_review": false,
  "flags":              [],
  "references":         ["<band_message_id>"]
}
```

## API Endpoints (Phase 1 complete)
- `GET  /health`
- `POST /auth/register` → 201 `{id, email, name}`
- `POST /auth/login`    → 200 `{access_token, token_type, expires_in}`
- All protected endpoints: `Authorization: Bearer <jwt>`

## Environment Variables
See `backend/.env.example`. Key vars:
- `MONGODB_URI`, `DB_NAME`
- `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`
- `REDIS_URL`
- `BAND_API_KEY`
- `AIMLAPI_KEY` — AIML API key (https://aimlapi.com)
- `MODEL_ID` — default `deepseek/deepseek-v4-flash`
- `GITHUB_TOKEN` — optional, increases GitHub API rate limits
- `CORS_ORIGINS`

## Development Phases
| Phase | Days | Status |
|---|---|---|
| 1 — Foundation & Auth | 1–2 | ✅ Complete + QA passed |
| 2 — Band Integration & Agent Core | 3–4 | ✅ Complete |
| 3 — Full Report UI + Diff Mode | 5–6 | ✅ Complete |
| 4 — Performance, UX Polish & Unique Features | 7 | ✅ Complete |
| 5 — Final Integration QA & Demo Prep | 8 | ✅ Complete |

## Phase 2 — Band Integration & Agent Core
- `band/client.py` — wraps `thenvoi_rest.AsyncRestClient`; `create_room` → `agent_api_chats.create_agent_chat`; `post_message` → `agent_api_events.create_agent_chat_event` (type=`tool_result`, payload in `metadata`); `get_room_messages` → `agent_api_context.get_agent_chat_context`
- All 4 agents share a single Band API key; each reads prior events via `get_agent_chat_context(room_id)`
- Agents post `tool_result` events; DEBATE posts an additional event with `output_type="DEBATE"` referencing the Architect message ID
- `orchestrator/pipeline.py` — async, sequential Security→Architect→Onboarding→Mentor; publishes SSE events to Redis pub/sub channel `sse:{session_id}`
- `orchestrator/tasks.py` — Celery task wraps pipeline with `asyncio.run()`; FastAPI falls back to `asyncio.create_task()` if Celery unavailable
- `POST /analyze` validates GitHub URL, creates session doc, dispatches Celery task
- `GET /analyze/stream/{session_id}` — SSE via `StreamingResponse` + Redis pub/sub
- `GET /reports/{session_id}` — returns full report; `GET /reports/{session_id}/download` — ZIP with ADR.md, CONTRIBUTING.md, ISSUE_1-3.md
- `GET /r/{share_token}` — public read-only (no auth)
- `frontend/app/analyze/page.tsx` — 4 agent cards with shimmer animation + live Band Room Viewer panel via SSE

## Phase 3 — Full Report UI + Diff Mode
- `report/[id]/page.tsx` — tabbed report: ADR.md, CONTRIBUTING.md, Setup (walkthrough), Issues, Mentor, Security; sparkline commit activity; download ZIP; copy share link
- `r/[share_token]/page.tsx` — public read-only shared view, same tabs, no auth, CTA to register
- `setup_walkthrough` persisted in report doc and included in ZIP as `SETUP.md`
- `diff_mode` toggle (BETA) on landing form, passed through to POST /analyze
- Security agent card added to landing page agent explainer grid

## Phase 4 — Performance, UX Polish & Unique Features
- Repo-analysis cache: same repo+SHA skips pipeline and returns existing session instantly (12h TTL, Redis)
- Rate limiting: 10 analyses per user per hour (Redis INCR)
- 30-day commit sparkline on report header (GitHub commits API, public repos)
- Skeleton shimmer with 500ms min-display guard on report page
- Human review banner when any agent has `confidence < 0.7`
- Agent DEBATE displayed in Mentor tab with full markdown rendering

## Phase 5 — Final Integration QA & Demo Prep
- `qa_phase5.py` — 15 checks: full pipeline integration (Band room, 4 agents, session, report, SSE events, share token) + HTTP layer (invalid URL 422, no auth 401, public share 200/404)
- All external services mocked (LLM, Band, GitHub, Redis) — no real credentials needed
- BandClient mock patches: `app.band.client.BandClient`, `app.agents.base.BandClient`, `app.band.session.BandClient`
- Model ID updated to `deepseek/deepseek-v4-flash` (replacing deprecated `deepseek-chat`)
- AI provider switched from AWS Bedrock to AIML API (`https://api.aimlapi.com/v1`, OpenAI-compatible)

## Phase 1 QA Results (all 15 checks passed)
- `GET /health` → `{status: ok}`
- `POST /auth/register` → 201, no secrets in response
- Duplicate email → 409
- Invalid email / short password → 422
- `POST /auth/login` → 200 with JWT
- Wrong password / unknown email → 401
- JWT round-trip (encode → decode)
- Invalid token raises ValueError
- `.env` in `.gitignore`, `.env.example` committed

## Key Conventions
- `bcrypt` used directly (not via passlib — incompatible with bcrypt 4.x+)
- Auth state persists via cookie (`auth_token`, SameSite=Strict)
- Frontend uses `"use client"` directive on all interactive pages
- Placeholder pages for `/analyze` and `/report/[id]` exist (Phase 2/3)
- QA script: `backend/qa_phase1.py` (uses mongomock-motor, no real DB needed)

## Running Locally
```bash
# Backend (no Docker)
docker run -d -p 6379:6379 redis:alpine
cp backend/.env.example backend/.env  # fill in values
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Or with Docker Compose
docker-compose up --build
```
