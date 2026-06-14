from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import UserCreate, UserOut
from app.auth.hash import hash_password, verify_password
from app.auth.jwt import create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()
bearer_optional = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate):
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    doc = {
        "email": body.email,
        "name": body.name,
        "hashed_password": hash_password(body.password),
    }
    result = await db.users.insert_one(doc)
    return UserOut(id=str(result.inserted_id), email=body.email, name=body.name)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token)


async def _user_from_token(raw_token: str) -> UserOut:
    try:
        user_id = decode_token(raw_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    db = get_db()
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(id=str(user["_id"]), email=user["email"], name=user["name"])


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    return await _user_from_token(credentials.credentials)


async def get_current_user_sse(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_optional),
):
    """Like get_current_user but also accepts ?token= for EventSource clients."""
    raw: str | None = None
    if credentials:
        raw = credentials.credentials
    else:
        raw = request.query_params.get("token")
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await _user_from_token(raw)
