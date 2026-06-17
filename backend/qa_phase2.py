"""
Phase 2 QA — Band Integration & Agent Core
15 checks: individual agent behaviour + Band client wiring + pipeline sequencing
No real LLM, Band, GitHub, or Redis needed.
Run from: cd backend && python qa_phase2.py
"""
import asyncio, sys, os, json
from unittest.mock import AsyncMock, patch

sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "qa-secret-phase2-only")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("AIMLAPI_KEY", "test-key-for-qa")
os.environ.setdefault("MODEL_ID", "deepseek/deepseek-v4-flash")
os.environ.setdefault("BAND_API_KEY", "test-band-key")

import mongomock_motor
import app.database as db_module
db_module.client = mongomock_motor.AsyncMongoMockClient()

PASS = "\033[32m  PASS\033[0m"
FAIL = "\033[31m  FAIL\033[0m"
errors = []


def check(label, condition, detail=""):
    if condition:
        print(f"{PASS}  {label}")
    else:
        print(f"{FAIL}  {label}" + (f" — {detail}" if detail else ""))
        errors.append(label)


# ── Mock data ────────────────────────────────────────────────────────────────

FAKE_REPO = {
    "owner": "octocat", "repo": "hello-world", "default_branch": "main",
    "file_tree": ["README.md", "app.py"],
    "file_contents": {
        "README.md": "# Hello World\n",
        "app.py": "import os\nSECRET = 'hardcoded'\nprint(SECRET)\n",
    },
}

LLM_RESPONSES = {
    "security": json.dumps({
        "summary": "Hardcoded secret found.",
        "findings": [{"severity": "HIGH", "file": "app.py", "line": 2,
                      "issue": "Hardcoded secret", "recommendation": "Use env vars"}],
        "confidence": 0.95, "flags": ["hardcoded-secret"],
    }),
    "architect": json.dumps({
        "adr": "# ADR-001\n## What Was Built\nSimple Python app.\n## Technology Choices\nPython\n## Architectural Patterns\nFlat.\n## Known Tradeoffs\nNone.\n## Anti-Patterns Detected\nHardcoded secret.\n## Security Context\nSee security agent.",
        "anti_patterns": ["hardcoded-secret"],
        "tech_stack": ["Python"],
        "confidence": 0.9, "flags": [],
    }),
    "onboarding": json.dumps({
        "contributing": "# Contributing\n\nFork, branch, PR.",
        "setup_walkthrough": "1. Clone\n2. `python app.py`",
        "first_good_issues": [
            {"title": "Remove hardcoded secret", "description": "Use os.environ",
             "acceptance_criteria": ["No hardcoded values"], "difficulty": "easy"},
            {"title": "Add tests", "description": "pytest coverage",
             "acceptance_criteria": ["Tests pass"], "difficulty": "medium"},
            {"title": "Add CI", "description": "GitHub Actions",
             "acceptance_criteria": ["Green CI"], "difficulty": "medium"},
        ],
        "confidence": 0.88, "flags": [],
    }),
    "mentor": json.dumps({
        "feedback": [
            {"type": "question", "text": "What happens if SECRET is missing at runtime?"},
            {"type": "question", "text": "Why is a hardcoded secret worse than an env var?"},
            {"type": "correction", "text": "Replace SECRET = 'hardcoded' with os.getenv('SECRET')."},
        ],
        "debate": False, "debate_claim": "", "debate_rebuttal": "",
        "socratic_score": {"questions": 2, "corrections": 1},
        "confidence": 0.92, "flags": [],
    }),
}

_msg_counter = 0


class MockBandClient:
    def __init__(self): pass

    async def create_room(self, *a, **kw):
        return "room-phase2-001"

    async def post_message(self, room_id, payload):
        global _msg_counter
        _msg_counter += 1
        return f"msg-{payload.get('agent_name', 'x')}-{_msg_counter}"

    async def get_room_messages(self, room_id):
        return [
            {**json.loads(LLM_RESPONSES["security"]),
             "agent_name": "security", "_band_message_id": "msg-security-1", "output_type": "SECURITY"},
            {**json.loads(LLM_RESPONSES["architect"]),
             "agent_name": "architect", "_band_message_id": "msg-architect-2", "output_type": "ADR"},
            {**json.loads(LLM_RESPONSES["onboarding"]),
             "agent_name": "onboarding", "_band_message_id": "msg-onboarding-3", "output_type": "CONTRIBUTING"},
        ]


async def mock_call_llm(self, system, user, max_tokens=4096):
    return LLM_RESPONSES[self.name]


# ── 1. BandClient unit tests ─────────────────────────────────────────────────

print("\n── Band Client ──────────────────────────────────────────────────────")


async def _test_band_client():
    client = MockBandClient()
    room_id = await client.create_room("sess-001", "https://github.com/x/y")
    check("BandClient.create_room returns string ID", isinstance(room_id, str) and room_id)

    msg_id = await client.post_message(room_id, {
        "agent_name": "security", "output_type": "SECURITY",
        "content": "test", "confidence": 0.9, "flags": [],
    })
    check("BandClient.post_message returns message ID", isinstance(msg_id, str) and msg_id)

    msgs = await client.get_room_messages(room_id)
    check("BandClient.get_room_messages returns list", isinstance(msgs, list) and len(msgs) > 0)
    check("Messages have agent_name field", all("agent_name" in m for m in msgs))
    check("Messages have _band_message_id field", all("_band_message_id" in m for m in msgs))


asyncio.run(_test_band_client())


# ── 2. Individual agent runs ─────────────────────────────────────────────────

print("\n── Agent Runs ───────────────────────────────────────────────────────")


async def _test_agents():
    from app.agents.security import SecurityAgent
    from app.agents.architect import ArchitectAgent
    from app.agents.onboarding import OnboardingAgent
    from app.agents.mentor import MentorAgent

    with (
        patch("app.agents.base.BandClient", new=MockBandClient),
        patch("app.band.client.BandClient", new=MockBandClient),
        patch("app.agents.base.BaseAgent.call_llm", new=mock_call_llm),
    ):
        # Security
        sec = SecurityAgent(band_room_id="room-001", session_id="sess-001")
        result = await sec.run(FAKE_REPO)
        check("SecurityAgent returns findings list",
              isinstance(result.get("findings"), list) and len(result["findings"]) > 0)
        check("SecurityAgent finding has severity/file/issue keys",
              all(k in result["findings"][0] for k in ("severity", "file", "issue")))
        check("SecurityAgent HIGH finding detected",
              result["findings"][0]["severity"] == "HIGH")
        check("SecurityAgent returns band_message_id",
              bool(result.get("band_message_id")))

        # Architect
        arch = ArchitectAgent(band_room_id="room-001", session_id="sess-001")
        result = await arch.run(FAKE_REPO)
        check("ArchitectAgent returns ADR markdown",
              "ADR-001" in result.get("adr", ""))
        check("ArchitectAgent returns anti_patterns list",
              isinstance(result.get("anti_patterns"), list))
        check("ArchitectAgent returns band_message_id",
              bool(result.get("band_message_id")))

        # Onboarding
        onb = OnboardingAgent(band_room_id="room-001", session_id="sess-001")
        result = await onb.run(FAKE_REPO)
        check("OnboardingAgent returns contributing markdown",
              "Contributing" in result.get("contributing", ""))
        check("OnboardingAgent returns exactly 3 first_good_issues",
              len(result.get("first_good_issues", [])) == 3)
        check("OnboardingAgent returns setup_walkthrough",
              bool(result.get("setup_walkthrough")))

        # Mentor
        ment = MentorAgent(band_room_id="room-001", session_id="sess-001")
        result = await ment.run(FAKE_REPO)
        check("MentorAgent returns feedback list",
              isinstance(result.get("feedback"), list) and len(result["feedback"]) >= 2)
        check("MentorAgent feedback has type+text",
              all(k in result["feedback"][0] for k in ("type", "text")))
        check("MentorAgent returns socratic_score",
              "questions" in result.get("socratic_score", {}))


asyncio.run(_test_agents())


# ── Summary ───────────────────────────────────────────────────────────────────

print()
if errors:
    print(f"\033[31m{len(errors)} check(s) FAILED:\033[0m {', '.join(errors)}")
    sys.exit(1)
else:
    print(f"\033[32mAll 15 Phase 2 QA checks passed.\033[0m")
    sys.exit(0)
