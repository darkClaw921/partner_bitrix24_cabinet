"""API dependencies."""
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from src.backend.core.database import get_main_db
from src.backend.models.user import User
from src.backend.services.auth import AuthService

from src.backend.core.config import settings


def get_current_user(
    session_id: str | None = Cookie(None, alias=settings.SESSION_COOKIE_NAME),
    x_internal_api_key: str | None = Header(None),
    db: Session = Depends(get_main_db),
) -> User:
    """Get current authenticated user from session or internal API key.

    Supports X-Internal-API-Key header for service-to-service auth.
    """
    # Check internal API key first (service-to-service)
    if x_internal_api_key and settings.INTERNAL_API_KEY and x_internal_api_key == settings.INTERNAL_API_KEY:
        admin_user = db.query(User).filter(User.role == "admin").first()
        if admin_user:
            return admin_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No admin user found for internal API key auth",
        )

    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session_data = AuthService.get_session(session_id)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    user = db.query(User).filter(User.id == session_data["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current user and verify admin role.

    Args:
        current_user: Current authenticated user

    Returns:
        Admin user

    Raises:
        HTTPException: If not admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user

