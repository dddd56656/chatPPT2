"""
任务数据模型定义 - 包含(异步)任务模型和(同步)生成模型

CTO注：这是应用的 "数据合约" (Data Contract)。
它定义了API的请求(Request)和响应(Response)结构。
使用Pydantic可以确保所有进出的数据都是类型安全和经过验证的。
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from enum import Enum


# --- 异步任务模型 (用于 /tasks API) ---

class TaskStatus(str, Enum):
    """(异步)任务状态枚举"""
    PENDING = "pending"   # 任务已提交，排队中
    PROGRESS = "progress" # 任务正在被Worker执行
    SUCCESS = "success"   # 任务已成功完成
    FAILURE = "failure"   # 任务执行失败

class TaskRequest(BaseModel):
    """(异步)创建批处理任务的请求模型 (POST /tasks)"""
    user_prompt: str = Field(..., description="用户提示词")

class TaskResultData(BaseModel):
    """
    (异步)任务成功时的标准结果结构 (Data Contract)。
    这是 Celery Worker 在 *成功* 时必须返回的Pydantic模型。
    `routers/tasks.py` 会验证此结构。
    """
    status: str = Field(..., description="内部成功状态", json_schema_extra={"example": "success"})
    # [CTO注]：必须是绝对路径，以便 FileResponse 可以找到它
    ppt_file_path: str = Field(..., description="生成的PPT文件的绝对路径")
    message: Optional[str] = Field(None, description="附加信息", json_schema_extra={"example": "PPT生成成功"})

class TaskResponse(BaseModel):
    """(异步)任务响应模型 (GET /tasks/{id} 和 POST /tasks)"""
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态 (来自TaskStatus枚举)")
    # [CTO注]：result 字段现在被强类型约束为 TaskResultData
    result: Optional[TaskResultData] = Field(None, description="任务结果 (当状态为SUCCESS时)")
    error: Optional[str] = Field(None, description="错误信息 (当状态为FAILURE时)")


# --- [新] 同步生成模型 (用于 /generation API) ---

class OutlineRequest(BaseModel):
    """(同步)生成大纲的请求模型 (POST /generation/outline)"""
    user_prompt: str = Field(..., description="用户提示词")

class OutlineResponse(BaseModel):
    """(同步)生成大纲的响应模型 (POST /generation/outline)"""
    status: str = Field(..., description="内部状态", json_schema_extra={"example": "success"})
    # (CTO注: 假设 'outline' 是一个灵活的字典结构。
    #  理想情况下，这应该是一个强类型的 Pydantic 模型，例如 OutlineModel)
    outline: Dict[str, Any] = Field(..., description="生成的大纲JSON结构")
    error: Optional[str] = Field(None, description="错误信息")

class ContentRequest(BaseModel):
    """(同步)生成内容的请求模型 (POST /generation/content)"""
    user_prompt: str = Field(..., description="原始用户提示词")
    # 客户端(聊天框)将发回它当前持有的大纲
    outline: Dict[str, Any] = Field(..., description="用于生成内容的大纲JSON")

class ContentResponse(BaseModel):
    """(同步)生成内容的响应模型 (POST /generation/content)"""
    status: str = Field(..., description="内部状态", json_schema_extra={"example": "success"})
    content: Dict[str, Any] = Field(..., description="生成的PPT内容JSON结构")
    error: Optional[str] = Field(None, description="错误信息")

class ExportRequest(BaseModel):
    """(异步)触发最终导出的请求模型 (POST /generation/export)"""
    # 客户端(聊天框)将发回它最终确认的内容
    content: Dict[str, Any] = Field(..., description="用于导出的最终内容JSON")
