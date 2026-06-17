from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str
    db_name: str = "devmentor"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    redis_url: str = "redis://localhost:6379"
    band_api_key: str = ""
    aimlapi_key: str = ""
    model_id: str = "deepseek-chat"
    github_token: str = ""
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
