"""
应用配置管理文件 - Google Standard Refactor (保留文件I/O字段)
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
    应用配置类 
    """
    # 应用配置
    app_name: str = "chatppt"
    debug: bool = False
    
    # [FIXED] Redis配置: 使用 Docker Service Name
    redis_url: str = "redis://redis:6379/0" 

    # [Restored] 文件路径配置 (保留本地文件 I/O)
    output_dir: str = "./output"
    template_dir: str = "./templates"
    upload_dir: str = "./uploads"
    
    # [Generative AI]
    deepseek_api_key: str = ""

    # [RAG Core] 本地化 RAG 配置
    embedding_model_name: str = "moka-ai/m3e-base"
    # [FIXED] Milvus配置: 使用 Docker Service Name
    milvus_host: str = "milvus" 
    milvus_port: str = "19530"
    milvus_collection: str = "chatppt_rag_v1"
    
    # 注意：Celery 相关的字段（celery_broker_url 等）已从模型中删除。

    class Config:
        case_sensitive = False
        env_file = ".env"

settings = Settings()