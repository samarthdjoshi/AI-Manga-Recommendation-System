"""
Password hashing and JWT token creation/verification for user auth.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from common.config import settings


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password for storage. Never store plain_password directly."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        # Malformed hash (e.g. corrupted data) - treat as invalid, not a crash.
        return False


def create_access_token(user_id: int, username: str) -> str:
    """
    Create a signed JWT for an authenticated user.

    Payload includes 'sub' (subject - the user id, as a string per JWT
    spec convention), 'username' for convenience without an extra DB
    lookup, and standard 'iat'/'exp' claims.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


class InvalidTokenError(Exception):
    pass


def decode_access_token(token: str) -> dict:
    """
    Verify and decode a JWT. Raises InvalidTokenError on any failure
    (expired, tampered signature, malformed) rather than leaking the
    underlying pyjwt exception type to callers.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise InvalidTokenError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError("Token is invalid") from exc

    return payload
