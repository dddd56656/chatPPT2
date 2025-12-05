from fastapi import APIRouter
from . import generation, rag # [Modified] 引入新的 rag 路由模块
# 创建主路由实例
router = APIRouter()

# 仅保留 AI 生成路由
router.include_router(generation.router, tags=["Conversational Generation (Async)"])
# [New] 包含 RAG 知识库路由，URL 前缀设置为 /rag
router.include_router(rag.router, prefix="/rag", tags=["Knowledge Base"])