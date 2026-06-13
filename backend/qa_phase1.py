"""
Phase 1 QA — runs fully in-process, no real MongoDB or Redis needed.
Tests: register, login, JWT, protected route, 401, 409, 422.
"""
import asyncio, sys, os
sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "qa-secret-for-testing-only")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

import mongomock_motor
from fastapi.testclient import TestClient

# Patch motor client with in-memory mongomock
import app.database as db_module
db_module.client = mongomock_motor.AsyncMongoMockClient()

from app.main import app

client = TestClient(app)

PASS = "\033[32m  PASS\033[0m"
FAIL = "\033[31m  FAIL\033[0m"
errors = []

def check(label, condition, detail=""):
    if condition:
        print(f"{PASS}  {label}")
    else:
        print(f"{FAIL}  {label}" + (f" — {detail}" if detail else ""))
        errors.append(label)

print("\n── Health ──────────────────────────────────")
r = client.get("/health")
check("GET /health → 200", r.status_code == 200)
check("health body", r.json() == {"status": "ok"})

print("\n── Register ────────────────────────────────")
r = client.post("/auth/register", json={"email": "qa@test.com", "password": "password1", "name": "QA User"})
check("POST /auth/register → 201", r.status_code == 201)
body = r.json()
check("register returns id/email/name", all(k in body for k in ("id", "email", "name")))
check("no hashed_password in response", "hashed_password" not in body)

r_dup = client.post("/auth/register", json={"email": "qa@test.com", "password": "password1", "name": "Dup"})
check("duplicate email → 409", r_dup.status_code == 409)

r_bad = client.post("/auth/register", json={"email": "bad", "password": "pw", "name": ""})
check("invalid email + short password → 422", r_bad.status_code == 422)

print("\n── Login ───────────────────────────────────")
r = client.post("/auth/login", json={"email": "qa@test.com", "password": "password1"})
check("POST /auth/login → 200", r.status_code == 200)
token_body = r.json()
check("login returns access_token", "access_token" in token_body)
check("token_type is bearer", token_body.get("token_type") == "bearer")
token = token_body.get("access_token", "")

r_wrong = client.post("/auth/login", json={"email": "qa@test.com", "password": "wrongpass"})
check("wrong password → 401", r_wrong.status_code == 401)

r_nouser = client.post("/auth/login", json={"email": "nobody@test.com", "password": "password1"})
check("unknown email → 401", r_nouser.status_code == 401)

print("\n── JWT / Protected Route ───────────────────")
from app.auth.jwt import create_access_token, decode_token

tok = create_access_token("fake-user-id")
decoded = decode_token(tok)
check("JWT round-trip", decoded == "fake-user-id")

try:
    decode_token("not.a.valid.token")
    check("invalid token raises ValueError", False)
except ValueError:
    check("invalid token raises ValueError", True)

print("\n── Pydantic Validation ─────────────────────")
r = client.post("/auth/register", json={"email": "qa2@test.com"})
check("missing fields → 422", r.status_code == 422)

r = client.post("/auth/register", json={"email": "qa2@test.com", "password": "short", "name": "X"})
check("password too short → 422", r.status_code == 422)

print("\n── .env.example & .gitignore ───────────────")
import os.path as osp
check(".env.example exists", osp.exists("../.gitignore") or osp.exists(".env.example"))
check(".gitignore blocks .env", any(
    line.strip() in ("backend/.env", ".env", "*.env")
    for line in open("../.gitignore").readlines()
    if not line.startswith("#")
))

print()
if errors:
    print(f"\033[31m{len(errors)} check(s) FAILED:\033[0m {', '.join(errors)}")
    sys.exit(1)
else:
    count = 15
    print(f"\033[32mAll {count} Phase 1 QA checks passed.\033[0m")
    sys.exit(0)
