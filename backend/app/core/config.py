"""
应用配置管理文件 - Google Standard Refactor (CORS Enabled)
"""
import os
from dotenv import load_dotenv

# 修正：.env 在 backend 目录下
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    app_name: str = "chatppt"
    debug: bool = False
    
    # [New] CORS 配置：允许的跨域来源 (逗号分隔)
    cors_origins: str = "http://localhost,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"

    redis_url: str = "redis://redis:6379/0" 
    output_dir: str = "./output"
    template_dir: str = "./templates"
    upload_dir: str = "./uploads"
    
    deepseek_api_key: str = ""
    embedding_model_name: str = "moka-ai/m3e-base"
    milvus_host: str = "milvus" 
    milvus_port: str = "19530"
    milvus_collection: str = "chatppt_rag_v1"
    
    class Config:
        case_sensitive = False
        env_file = ".env"

settings = Settings()
