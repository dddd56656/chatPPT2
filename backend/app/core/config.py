"""
应用配置管理文件 - Google Standard Refactor
已移除 Celery 和本地文件存储相关配置，仅保留核心 AI 服务配置。
"""

import os
from dotenv import load_dotenv

# 健壮的路径回溯
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    """
    应用配置类 (Slim Version)
    """
    app_name: str = "chatppt"
    debug: bool = False
    
    # LangChain Memory 仍需 Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # 核心 AI 服务凭证
    deepseek_api_key: str = ""

    class Config:
        case_sensitive = False
        env_file = ".env"

settings = Settings()
