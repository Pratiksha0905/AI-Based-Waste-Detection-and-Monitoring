"""EcoWatch AI — Authentication routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfile
from app.services.auth_service import login, register_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserProfile, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.  Role is always 'user' — never admin.
    """
    user = await register_user(db, data)
    return UserProfile.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login_endpoint(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive a JWT Bearer token."""
    return await login(db, data)


@router.get("/me", response_model=UserProfile)
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile and role."""
    return UserProfile.model_validate(current_user)
