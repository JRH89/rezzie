from rezzie.auth import verified_user_id
from rezzie.config import Settings


def test_development_identity_is_header_scoped() -> None:
    settings = Settings(environment="development")
    assert verified_user_id(settings, None, "local-user") == "local-user"


def test_development_identity_is_optional_for_byok_flows() -> None:
    settings = Settings(environment="development")
    assert verified_user_id(settings, None, None) is None
