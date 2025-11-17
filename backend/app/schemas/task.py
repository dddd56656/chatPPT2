"""
任务数据模型定义 - 包含(异步)任务模型和(对话式)生成模型

CTO注：[V2 重构]
此文件已更新。
- 保留了核心的 TaskResponse 和 TaskResultData (用于轮询)。
- 删除了已过时的同步 Outline/Content 请求/响应模型。
- 新增了 'ConversationalOutlineRequest' 和 'ConversationalContentRequest'
  来作为 V2 异步生成 API 的请求体。
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum


# --- 1. 异步任务模型 (用于 /tasks 和轮询) ---


class TaskStatus(str, Enum):
    """(异步)任务状态枚举"""

    PENDING = "pending"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"


class TaskRequest(BaseModel):
    """(异步)创建批处理任务的请求模型 (POST /tasks)"""

    user_prompt: str = Field(..., description="用户提示词")


class TaskResultData(BaseModel):
    """
    (异步)任务成功时的标准结果结构 (Data Contract)。
    这是 Celery Worker 在 *成功* 时必须返回的Pydantic模型。
    `routers/tasks.py` 会验证此结构。
    """

    status: str = Field(
        ..., description="内部成功状态", json_schema_extra={"example": "success"}
    )
    ppt_file_path: str = Field(..., description="生成的PPT文件的绝对路径")
    message: Optional[str] = Field(
        None, description="附加信息", json_schema_extra={"example": "PPT生成成功"}
    )

    # [V2 扩展] 允许轮询结果也包含JSON数据 (例如大纲或内容)
    # 这使得轮询逻辑可以统一
    outline: Optional[Dict[str, Any]] = Field(None, description="[V2] 生成的大纲JSON")
    slides_data: Optional[List[Dict[str, Any]]] = Field(
        None, description="[V2] 生成的内容JSON"
    )


class TaskResponse(BaseModel):
    """(异步)任务响应模型 (所有异步 API 的标准返回)"""

    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态 (来自TaskStatus枚举)")
    result: Optional[TaskResultData] = Field(None, description="任务结果 (当状态为SUCCESS时)")
    error: Optional[str] = Field(None, description="错误信息 (当状态为FAILURE时)")


# --- 2. [V2 新] 对话式生成模型 (用于 /generation API) ---


class ConversationalOutlineRequest(BaseModel):
    """(V2 异步) 对话式生成大纲的请求 (POST /generation/outline_conversational)"""

    history: List[Dict[str, str]] = Field(..., description="完整的聊天记录")


class ConversationalContentRequest(BaseModel):
    """(V2 异步) 对话式生成内容的请求 (POST /generation/content_conversational)"""

    history: List[Dict[str, str]] = Field(..., description="完整的聊天记录")
    current_slides: List[Dict[str, Any]] = Field(..., description="当前前端持有的幻灯片数据")


class ExportRequest(BaseModel):
    """(异步)触发最终导出的请求模型 (POST /generation/export)"""

    # [V2 修复] 明确定义 'content' 结构
    content: Dict[str, Any] = Field(
        ..., description="用于导出的最终内容JSON (包含 title 和 slides_data)"
    )
