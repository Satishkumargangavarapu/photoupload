from datetime import datetime, timedelta, timezone
import importlib
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

try:
    ObjectId = importlib.import_module("bson").ObjectId
except Exception:
    ObjectId = None

from .config import get_settings
from .db import Database

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def to_object_id(val: str | None):
    """Safely convert a string to a BSON ObjectId, returning None on failure."""
    if not val or ObjectId is None or not callable(ObjectId):
        return None
    try:
        return ObjectId(str(val))
    except Exception:
        return None


def hash_password(password: str) -> str:
    """Hash a password using bcrypt, falling back to passlib if needed."""
    try:
        pw_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")
    except Exception:
        return password_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt or passlib hash."""
    if not password or not hashed:
        return False
    try:
        pw_bytes = password.encode("utf-8")[:72]
        hashed_bytes = hashed.encode("utf-8")
        if bcrypt.checkpw(pw_bytes, hashed_bytes):
            return True
    except Exception:
        pass
    try:
        return password_context.verify(password, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    """Generate a JWT access token for a user."""
    settings = get_settings()
    claims = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    """Authenticate request using JWT token, returning the user dict."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().jwt_secret,
            algorithms=[get_settings().jwt_algorithm],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise JWTError()
        oid = to_object_id(user_id)
        query = {"_id": oid} if oid else {"_id": user_id}
        user = await Database.get().users.find_one(query)
    except Exception:
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if "_id" in user:
        user["id"] = str(user.pop("_id"))
    elif "id" in user:
        user["id"] = str(user["id"])
    return user


def require_super_admin(user: dict = Depends(current_user)):
    """Authorize super_admin users only."""
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return user


def require_event_manager(user: dict = Depends(current_user)):
    """Authorize event_manager and super_admin users."""
    if user.get("role") not in {"event_manager", "super_admin"}:
        raise HTTPException(status_code=403, detail="Event-manager access required")
    return user


async def event_for_user(event_id: str, user: dict):
    """Fetch event and verify user has authorization to access it."""
    oid = to_object_id(event_id)
    try:
        query = {"_id": oid} if oid else {"_id": event_id}
        event = await Database.get().events.find_one(query)
    except Exception:
        event = None

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    user_role = user.get("role")
    user_id = str(user.get("id") or "")
    created_by = str(event.get("created_by") or "")
    team_members = [str(m) for m in event.get("team_members", [])]

    if (
        user_role != "super_admin"
        and user_id != created_by
        and user_id not in team_members
    ):
        raise HTTPException(status_code=403, detail="You do not have access to this event")

    if "_id" in event:
        event["id"] = str(event.pop("_id"))
    elif "id" in event:
        event["id"] = str(event["id"])
    return event