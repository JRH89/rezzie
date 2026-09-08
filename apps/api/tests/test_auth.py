from rezzie.auth import is_configured_admin, verified_identity, verified_user_id
from rezzie.config import Settings


def test_development_identity_is_header_scoped() -> None:
    settings = Settings(environment="development")
    assert verified_user_id(settings, None, "local-user") == "local-user"


def test_development_identity_is_optional_for_byok_flows() -> None:
    settings = Settings(environment="development")
    assert verified_user_id(settings, None, None) is None


def test_administrator_requires_the_configured_verified_email() -> None:
    settings = Settings(environment="development", admin_email="jaredroberthooker@gmail.com")
    identity = verified_identity(settings, None, "admin-user", "jaredroberthooker@gmail.com")
    assert is_configured_admin(settings, identity)
