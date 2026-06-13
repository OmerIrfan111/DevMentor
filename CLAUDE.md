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
| AI | AWS Bedrock (claude-3-5-sonnet) via BedrockClient |
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
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `CORS_ORIGINS`

## Development Phases
| Phase | Days | Status |
|---|---|---|
| 1 — Foundation & Auth | 1–2 | ✅ Complete + QA passed |
| 2 — Band Integration & Agent Core | 3–4 | Pending |
| 3 — Full Report UI + Diff Mode | 5–6 | Pending |
| 4 — Performance, UX Polish & Unique Features | 7 | Pending |
| 5 — Final Integration QA & Demo Prep | 8 | Pending |

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
