"""
API路由聚合器

CTO注：此文件非常重要。它将所有独立的路由文件
(tasks.py, generation.py) 导入并聚合到一个
APIRouter 实例中。

这使得 app/main.py 只需要导入这一个 'router' 即可注册
所有V1 API端点。
"""

from fastapi import APIRouter
from . import tasks
from . import generation

# 创建主路由实例
router = APIRouter()

# 包含异步(批处理)任务路由
router.include_router(tasks.router, tags=["Async Tasks (Workflow)"])

# 包含同步(聊天式)生成路由
router.include_router(generation.router, tags=["Conversational Generation (Async)"])
