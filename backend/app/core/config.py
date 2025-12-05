"""
应用配置管理文件 - Google Standard Refactor (Local RAG Version)
"""
import os
from dotenv import load_dotenv

# 健壮的路径回溯，确保能找到项目根目录的 .env
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    """
    应用配置类
    """
    app_name: str = "chatppt"
    debug: bool = False
    
    # LangChain Memory 仍需 Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # [Generative AI] 核心生成服务凭证 (DeepSeek)
    deepseek_api_key: str = ""

    # [RAG Core] 本地化 RAG 配置 (最省钱方案)
    # 1. Embedding: 使用本地 HuggingFace 模型 (无需 OpenAI Key，完全免费)
    # 推荐: "moka-ai/m3e-base" (中文效果极佳，体积小)
    embedding_model_name: str = "moka-ai/m3e-base"
    
    # 2. Vector DB (Milvus 本地 Docker)
    milvus_host: str = "127.0.0.1"
    milvus_port: str = "19530"
    milvus_collection: str = "chatppt_rag_v1"

    class Config:
        case_sensitive = False
        env_file = ".env"

settings = Settings()