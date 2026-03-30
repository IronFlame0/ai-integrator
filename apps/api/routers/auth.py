from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from core.db import get_pool
from core.security import hash_password, verify_password, create_token
from core.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Пароль должен быть не менее 6 символов",
        )

    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT id FROM users WHERE email = $1", req.email
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    hashed = hash_password(req.password)
    user = await pool.fetchrow(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) "
        "RETURNING id, email, created_at",
        req.email,
        hashed,
    )

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {"id": str(user["id"]), "email": user["email"]},
    }


@router.post("/login")
async def login(req: LoginRequest):
    pool = await get_pool()

    user = await pool.fetchrow(
        "SELECT id, email, hashed_password, is_active "
        "FROM users WHERE email = $1",
        req.email,
    )

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован",
        )

    token = create_token(str(user["id"]), user["email"])
    return {
        "token": token,
        "user": {"id": str(user["id"]), "email": user["email"]},
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
