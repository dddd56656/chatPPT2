"""
应用配置管理文件 - 加载环境变量和配置参数
使用 Pydantic BaseSettings 实现类型安全和自动加载
"""

import os
from dotenv import load_dotenv

# CTO注：此路径计算是健壮的。它从当前文件(__file__)向上回溯两级
# (app/core -> app -> backend) 然后查找 .env 文件。
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

try:
    # Pydantic 2.x 兼容导入 (推荐)
    from pydantic_settings import BaseSettings
except ImportError:
    # Pydantic 1.x 兼容导入 (兜底)
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """
    应用配置类 - 自动从环境变量和.env文件读取配置。
    """
    
    # 应用名称 - 对应环境变量 APP_NAME
    app_name: str = "chatppt"
    
    # 调试模式 - 对应环境变量 DEBUG
    debug: bool = False
    
    # Redis连接地址 - 对应环境变量 REDIS_URL
    redis_url: str = "redis://localhost:6379/0"
    
    # Celery任务队列地址 - 对应环境变量 CELERY_BROKER_URL
    celery_broker_url: str = "redis://localhost:6379/0"
    
    # Celery结果存储地址 - 对应环境变量 CELERY_RESULT_BACKEND
    celery_result_backend: str = "redis://localhost:6379/0"
    
    # Celery时区配置 - 对应环境变量 CELERY_TIMEZONE
    celery_timezone: str = "Asia/Shanghai"
    
    # 输出文件目录 - 对应环境变量 OUTPUT_DIR
    output_dir: str = "./output"
    
    # 模板文件目录 - 对应环境变量 TEMPLATE_DIR
    template_dir: str = "./templates"
    
    # 上传文件目录 - 对应环境变量 UPLOAD_DIR
    upload_dir: str = "./uploads"
    
    # DeepSeek API密钥 - 对应环境变量 DEEPSEEK_API_KEY
    # CTO注：默认为空字符串。服务层(outline.py)中必须有检查，
    # 否则会在运行时失败。
    deepseek_api_key: str = ""
    
    class Config:
        """Pydantic 配置"""
        case_sensitive = False  # 环境变量不区分大小写
        env_file = ".env"       # 明确指定env文件


# 创建全局配置实例，供应用各处导入使用
settings = Settings()
