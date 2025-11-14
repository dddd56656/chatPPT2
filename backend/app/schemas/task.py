"""
任务数据模型定义 - 包含任务请求、响应和状态模型
(符合Pydantic最佳实践，用于定义API的数据合约)
"""

from pydantic import BaseModel, Field
# `typing` 库用于定义精确的数据类型
from typing import Dict, Any, Optional
# `Enum` (枚举) 用于创建一组有限的常量值
from enum import Enum


class TaskStatus(str, Enum):
    """
    任务状态枚举 (Enum)。
    
    通过继承 (str, Enum)，我们确保这些状态在API中
    既是人类可读的字符串，又在代码中受到强类型约束。
    这是一个优秀的设计。
    """
    PENDING = "pending"   # 任务已提交，正在排队
    PROGRESS = "progress" # 任务正在被Worker执行
    SUCCESS = "success"   # 任务已成功完成
    FAILURE = "failure"   # 任务执行失败


class TaskRequest(BaseModel):
    """
    任务创建请求模型 (POST /tasks 的输入体)。
    
    它定义了创建任务 *必须* 携带的数据。
    """
    # Field(..., description=...) 中的 `...` (Ellipsis)
    # 意味着这个字段是 *必需的* (required)。
    user_prompt: str = Field(..., description="用户提示词")


# --- [P1 修复] 新增明确的结果模型 ---
class TaskResultData(BaseModel):
    """
    任务成功时的标准结果结构 (Data Contract)。
    这是 'generate_ppt_task' 任务成功时返回的数据。
    """
    status: str = Field(..., description="内部成功状态", example="success")
    
    # 基于 app/worker/tasks.py 和 API 路由的推断，
    # 成功的结果必须包含一个文件路径。
    ppt_file_path: str = Field(..., description="生成的PPT文件的绝对路径")
    
    # 允许其他可能的附加信息
    message: Optional[str] = Field(None, description="附加信息", example="PPT生成成功")


class TaskResponse(BaseModel):
    """
    任务响应模型 (GET /tasks/{id} 和 POST /tasks 的输出体)。
    
    它定义了API向客户端 *承诺* 返回的数据结构。
    """
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态 (来自TaskStatus枚举)")
    
    # --- [P1 修复] 使用明确的 TaskResultData 替换模糊的 Dict ---
    #
    # 修复：`result` 字段现在明确指向 TaskResultData 模型。
    # API消费者 (如前端) 现在可以确切地知道
    # 成功时 `result` 字段中会有哪些数据 (例如 `result.ppt_file_path`)。
    #
    result: Optional[TaskResultData] = Field(None, description="任务结果 (当状态为SUCCESS时)")
    
    # 错误信息 (当状态为FAILURE时)
    error: Optional[str] = Field(None, description="错误信息")