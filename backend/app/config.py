from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str
    db_name: str = "devmentor"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    redis_url: str = "redis://localhost:6379"
    band_api_key: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    github_token: str = ""
    bedrock_model_id: str = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
