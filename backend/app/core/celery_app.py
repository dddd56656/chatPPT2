"""
Celery应用实例配置 - 定义异步任务队列和Redis后端
(修正版：移除特定环境的逻辑，确保所有环境配置统一)
"""

from celery import Celery
# 假设 .config 模块中有 settings 对象
from .config import settings

# --- 1. 创建Celery应用实例 ---
# 这是您项目中所有Celery功能的入口点
celery_app = Celery(
    "chatppt",
    # Broker: 任务队列 (生产者发送任务到这里)
    broker=settings.celery_broker_url,
    # Backend: 结果后端 (消费者将结果存到这里)
    backend=settings.celery_result_backend,
)

# --- 2. 定义统一的配置 ---
# 这个配置字典将统一应用于所有环境 (Windows, Linux, macOS)
celery_config = {
    # 序列化设置：使用json保证安全和跨语言兼容性
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    
    # 时区配置：从 settings 读取，而不是硬编码
    # (假设 settings 对象中有名为 CELERY_TIMEZONE 的变量)
    "timezone": getattr(settings, "CELERY_TIMEZONE", "Asia/Shanghai"),
    "enable_utc": True,
    
    # --- 任务可靠性配置 (Google标准) ---
    
    # 晚确认 (Late ACKs): 任务执行 *完成* 后才通知Broker。
    # 这能防止Worker在执行中崩溃导致任务丢失。
    # 要求：您的任务必须是“幂等”的 (即执行多次结果也一样)。
    "task_acks_late": True,
    
    # 崩溃拒绝：当Worker进程(非任务)崩溃时，也拒绝任务，使其重回队列。
    "task_reject_on_worker_lost": True,
    
    # 预取因子：配合 late-acks，设置Worker一次只预取1个任务。
    # 这可以防止Worker崩溃时，它预取的大量任务被卡住直到超时。
    "worker_prefetch_multiplier": 1,
}

# --- 3. 应用配置 ---
celery_app.conf.update(celery_config)

# --- 4. 自动发现任务 ---
# 指示Celery Worker启动时，自动去 "app.worker.tasks" 模块中查找任务
celery_app.autodiscover_tasks(["app.worker.tasks"])