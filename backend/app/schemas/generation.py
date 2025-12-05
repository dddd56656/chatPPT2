"""
数据模型层 - Conversational AI Only
仅保留流式生成所需的请求模型。
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional  # [Modified]: Added Optional


class ConversationalOutlineRequest(BaseModel):
    """大纲生成请求"""

    session_id: str = Field(..., description="Redis会话ID，用于上下文记忆")
    user_message: str = Field(..., description="用户的新指令")
    # [New Field] RAG 上下文注入
    # 前端 Sidebar 现有的文件 ID 列表将通过这里传进来
    rag_file_ids: Optional[List[str]] = Field(
        default=None, description="需要引用的知识库文件ID列表"
    )


class ConversationalContentRequest(BaseModel):
    """内容生成请求"""

    session_id: str
    user_message: str
    current_slides: List[Dict[str, Any]] = Field(
        ..., description="当前幻灯片状态(上下文)"
    )
