"""Celery应用实例配置 - 定义异步任务队列和Redis后端"""

from celery import Celery
from .config import settings

# 创建Celery应用实例
celery_app = Celery(
    "chatppt",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# 配置Celery
celery_config = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "Asia/Shanghai",
    "enable_utc": True,
}

# 仅在Windows开发环境下使用solo池
import platform
if platform.system() == "Windows":
    celery_config.update({
        "worker_pool": "solo",  # Windows下使用solo池避免进程问题
        "worker_disable_rate_limits": True,
        "task_acks_late": True,
        "worker_prefetch_multiplier": 1,
    })

celery_app.conf.update(celery_config)

# 自动发现任务
celery_app.autodiscover_tasks(["app.worker.tasks"])