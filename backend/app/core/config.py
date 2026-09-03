from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "LexiAudit AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="production")
    
    # AI API Keys
    GROQ_API_KEY: Optional[str] = Field(default=None)
    PAGEINDEX_API_KEY: Optional[str] = Field(default=None)
    
    # Database
    SUPABASE_URL: Optional[str] = Field(default=None)
    SUPABASE_SECRET_KEY: Optional[str] = Field(default=None)
    
    # Langfuse Telemetry
    LANGFUSE_PUBLIC_KEY: Optional[str] = Field(default=None)
    LANGFUSE_SECRET_KEY: Optional[str] = Field(default=None)
    LANGFUSE_HOST: Optional[str] = Field(default=None)
    LANGFUSE_BASE_URL: Optional[str] = Field(default=None)

    @property
    def langfuse_server_url(self) -> str:
        return self.LANGFUSE_BASE_URL or self.LANGFUSE_HOST or "https://cloud.langfuse.com"
    
    # Groq Model Configuration
    PRIMARY_GROQ_MODEL: str = "openai/gpt-oss-120b"
    FAST_GROQ_MODEL: str = "openai/gpt-oss-20b"
    GUARDRAIL_MODEL: str = "openai/gpt-oss-20b"
    
    # Security Configuration
    ENABLE_PII_REDACTION: bool = True
    ENABLE_GUARDRAILS: bool = True
    
    # Redis Cache
    REDIS_URL: Optional[str] = Field(default="redis://127.0.0.1:6379/0")
    TREE_CACHE_ENABLED: bool = Field(default=True)
    CACHE_TTL_SECONDS: int = Field(default=604800)
    CACHE_SECRET_KEY: Optional[str] = Field(default=None)

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

settings = Settings()
