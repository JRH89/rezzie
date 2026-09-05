import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException, status

from .schemas import CredentialMode


def require_generation_key(mode: CredentialMode, provided_key: str | None, master_key: str | None) -> str:
    if mode is CredentialMode.BYOK:
        if not provided_key:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="An Anthropic API key is required for BYOK mode.")
        return provided_key
    if not master_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Subscription generation is not configured.")
    return master_key


def assert_safe_public_url(raw_url: str) -> None:
    parsed = urlparse(raw_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=422, detail="Only HTTPS job-description URLs are accepted.")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise HTTPException(status_code=422, detail="The job-description host could not be resolved.") from error
    for _, _, _, _, address in addresses:
        ip = ipaddress.ip_address(address[0])
        if not ip.is_global:
            raise HTTPException(status_code=422, detail="Private or local URL targets are not allowed.")
