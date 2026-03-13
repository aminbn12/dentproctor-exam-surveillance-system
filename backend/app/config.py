import os
from pydantic_settings import BaseSettings
from typing import List

# Déterminer le chemin absolu du dossier backend
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "APP surveillances UM6SS API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"
    
    # Database - utiliser un chemin absolu pour la persistance
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BACKEND_DIR, 'dentproctor.db')}")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))
    
    # CORS
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
