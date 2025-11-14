"""任务数据模型定义 - 包含任务请求、响应和状态模型"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from enum import Enum


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"


class TaskRequest(BaseModel):
    """任务请求模型"""
    user_prompt: str = Field(..., description="用户提示词")


class TaskResponse(BaseModel):
    """任务响应模型"""
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态")
    result: Optional[Dict[str, Any]] = Field(None, description="任务结果")
    error: Optional[str] = Field(None, description="错误信息")