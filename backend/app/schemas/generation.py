"""
数据模型层 - Conversational AI Only
仅保留流式生成所需的请求模型。
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, List

class ConversationalOutlineRequest(BaseModel):
    """大纲生成请求"""
    session_id: str = Field(..., description="Redis会话ID，用于上下文记忆")
    user_message: str = Field(..., description="用户的新指令")

class ConversationalContentRequest(BaseModel):
    """内容生成请求"""
    session_id: str
    user_message: str
    current_slides: List[Dict[str, Any]] = Field(..., description="当前幻灯片状态(上下文)")
