"""Production OIDC access-token verification; local headers are development-only."""
from functools import lru_cache

import jwt
from fastapi import HTTPException, status

from .config import Settings


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def verified_user_id(settings: Settings, authorization: str | None, development_user_id: str | None) -> str | None:
    if settings.environment == "development":
        if development_user_id and len(development_user_id) <= 128: return development_user_id
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
    return subject
