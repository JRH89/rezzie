from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    anthropic_api_key: str | None = None
    allowed_origins: str = "http://localhost:5173"
    max_import_bytes: int = 200_000
    database_url: str = "sqlite:///./rezzie.db"
    app_url: str = "http://localhost:5173"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_subscription_price_id: str | None = None
    stripe_subscription_monthly_credits: int = 20
    stripe_credit_packs: str = "{}"
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    oidc_jwks_url: str | None = None
    clamav_host: str | None = None
    clamav_port: int = 3310

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
