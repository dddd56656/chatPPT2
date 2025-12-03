"""
任务数据模型定义 - [V3 流式版]

CTO注：
[V3 变更]: 在请求模型中新增了 `session_id` 字段。
这是 RunnableWithMessageHistory 在 Redis 中追踪对话历史的唯一键。
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum


# --- 1. 异步任务模型 (保留用于导出任务) ---

class TaskStatus(str, Enum):
    """(异步)任务状态枚举"""
    PENDING = "pending"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"


class TaskResultData(BaseModel):
    """(异步)任务成功时的标准结果结构"""
    status: str = Field(..., description="内部成功状态")
    ppt_file_path: Optional[str] = Field(None, description="生成的PPT文件的绝对路径")
    message: Optional[str] = Field(None, description="附加信息")


class TaskResponse(BaseModel):
    """(异步)任务响应模型"""
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态")
    result: Optional[TaskResultData] = Field(None, description="任务结果")
    error: Optional[str] = Field(None, description="错误信息")


# --- 2. [V3] 流式生成请求模型 ---

class ConversationalOutlineRequest(BaseModel):
    """(V3 流式) 大纲生成请求"""
    # [V3 新增] 会话ID，用于 Redis 记忆
    session_id: str = Field(..., description="会话唯一标识符 (UUID)")
    # V3 中，history 由后端自动从 Redis 读取，前端只需发送最新的一条 user message
    # 但为了兼容性和灵活性，我们允许前端传递当前消息
    user_message: str = Field(..., description="用户当前的输入消息")


class ConversationalContentRequest(BaseModel):
    """(V3 流式) 内容生成请求"""
    session_id: str = Field(..., description="会话唯一标识符 (UUID)")
    user_message: str = Field(..., description="用户当前的输入消息")
    # 内容生成仍需上下文中的 Slides 结构
    current_slides: List[Dict[str, Any]] = Field(..., description="当前前端持有的幻灯片数据")


class ExportRequest(BaseModel):
    """(异步) 触发导出任务 (保持 V2 逻辑，因是 CPU/IO 密集型)"""
    content: Dict[str, Any] = Field(..., description="用于导出的最终内容JSON")
