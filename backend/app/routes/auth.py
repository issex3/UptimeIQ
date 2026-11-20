"""JWT login (demo user from configuration).

DEMO ONLY — plaintext password compare for a single configured user.
Not suitable for production without hashing, multi-user auth, and lockout.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from jose import jwt

from app.config import settings
from app.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Issue a JWT for the configured demo user (plaintext compare — MVP only)."""
    if (
        body.username != settings.admin_username
        or body.password != settings.admin_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    token = jwt.encode(
        {"sub": body.username, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return TokenResponse(access_token=token)
