"""应用配置管理文件 - 加载环境变量和配置参数"""

import os
from dotenv import load_dotenv

# 加载.env文件
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

try:
    # Pydantic 2.x 兼容导入
    from pydantic_settings import BaseSettings
except ImportError:
    # Pydantic 1.x 兼容导入
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """应用配置类 - 自动从环境变量读取配置"""
    
    # 应用名称 - 对应环境变量 APP_NAME
    app_name: str = "ChatPPT"
    
    # 调试模式 - 对应环境变量 DEBUG
    debug: bool = False
    
    # Redis连接地址 - 对应环境变量 REDIS_URL
    redis_url: str = "redis://localhost:6379/0"
    
    # Celery任务队列地址 - 对应环境变量 CELERY_BROKER_URL
    celery_broker_url: str = "redis://localhost:6379/0"
    
    # Celery结果存储地址 - 对应环境变量 CELERY_RESULT_BACKEND
    celery_result_backend: str = "redis://localhost:6379/0"
    
    # 输出文件目录 - 对应环境变量 OUTPUT_DIR
    output_dir: str = "./output"
    
    # 模板文件目录 - 对应环境变量 TEMPLATE_DIR
    template_dir: str = "./templates"
    
    # 上传文件目录 - 对应环境变量 UPLOAD_DIR
    upload_dir: str = "./uploads"
    
    class Config:
        """配置类设置"""
        case_sensitive = False  # 环境变量不区分大小写


# 创建全局配置实例
settings = Settings()