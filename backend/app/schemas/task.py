"""
数据模型层 - Google Standard V3
职责: 定义前后端通信的严格契约 (Contract)。
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum

# --- 1. 导出任务模型 (CPU/IO 密集型) ---
class TaskStatus(str, Enum):
    PENDING = "pending"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"

class TaskResultData(BaseModel):
    """任务成功后的结果载荷"""
    status: str
    ppt_file_path: Optional[str] = None
    message: Optional[str] = None

class TaskResponse(BaseModel):
    """通用异步任务响应"""
    task_id: str
    status: TaskStatus
    result: Optional[TaskResultData] = None
    error: Optional[str] = None

class ExportRequest(BaseModel):
    """导出请求载荷"""
    content: Dict[str, Any] = Field(..., description="完整的幻灯片JSON数据")

# --- 2. 流式生成模型 (AI 密集型) ---
class ConversationalOutlineRequest(BaseModel):
    """大纲生成请求"""
    session_id: str = Field(..., description="Redis会话ID，用于上下文记忆")
    user_message: str = Field(..., description="用户的新指令")

class ConversationalContentRequest(BaseModel):
    """内容生成请求"""
    session_id: str
    user_message: str
    current_slides: List[Dict[str, Any]] = Field(..., description="当前幻灯片状态(上下文)")
