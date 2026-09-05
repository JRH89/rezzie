import pytest
from fastapi import HTTPException

from rezzie.schemas import CredentialMode
from rezzie.security import require_generation_key


def test_byok_requires_a_key() -> None:
    with pytest.raises(HTTPException) as error:
        require_generation_key(CredentialMode.BYOK, None, "master")
    assert error.value.status_code == 422


def test_byok_returns_request_scoped_key() -> None:
    assert require_generation_key(CredentialMode.BYOK, "user-key", "master") == "user-key"


def test_subscription_requires_a_server_key() -> None:
    with pytest.raises(HTTPException) as error:
        require_generation_key(CredentialMode.SUBSCRIPTION, None, None)
    assert error.value.status_code == 503
