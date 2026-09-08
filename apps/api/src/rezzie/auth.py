"""Production OIDC access-token verification; local headers are development-only."""
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException, status

from .config import Settings


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


@dataclass(frozen=True)
class VerifiedIdentity:
    user_id: str
    email: str | None
    email_verified: bool


def verified_identity(settings: Settings, authorization: str | None, development_user_id: str | None, development_user_email: str | None = None) -> VerifiedIdentity | None:
    if settings.environment == "development":
        if development_user_id and len(development_user_id) <= 128:
            email = development_user_email.strip().casefold() if development_user_email and len(development_user_email) <= 320 else None
            return VerifiedIdentity(user_id=development_user_id, email=email, email_verified=bool(email))
        return None
    if not all((settings.oidc_issuer, settings.oidc_audience, settings.oidc_jwks_url)):
        raise HTTPException(status_code=503, detail="OIDC is not configured.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer authentication is required.")
    token = authorization.removeprefix("Bearer ")
    try:
        signing_key = _jwks_client(settings.oidc_jwks_url).get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, signing_key, algorithms=["RS256", "ES256"], audience=settings.oidc_audience, issuer=settings.oidc_issuer)
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from error
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has no subject.")
    email_claim = claims.get("email")
    email = email_claim.strip().casefold() if isinstance(email_claim, str) and len(email_claim) <= 320 else None
    return VerifiedIdentity(user_id=subject, email=email, email_verified=claims.get("email_verified") is True)


def verified_user_id(settings: Settings, authorization: str | None, development_user_id: str | None) -> str | None:
    identity = verified_identity(settings, authorization, development_user_id)
    return identity.user_id if identity else None
