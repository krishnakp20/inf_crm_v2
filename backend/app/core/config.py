from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    database_url_sync: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: str = "http://localhost:5173"

    seed_admin_email: str = "kunal@sotrue.com"
    seed_admin_password: str = "change-me-admin"
    seed_admin_name: str = "Kunal Khurana"

    upload_dir: str = "uploads"
    max_upload_size_bytes: int = 25 * 1024 * 1024

    max_active_advisors: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
