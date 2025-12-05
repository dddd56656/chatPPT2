from fastapi import APIRouter
from . import generation

# 创建主路由实例
router = APIRouter()

# 仅保留 AI 生成路由
router.include_router(generation.router, tags=["Conversational Generation (Async)"])
