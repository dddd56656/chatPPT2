"""
RAG 业务数据模型 - 定义知识库文件的交互结构
"""
from pydantic import BaseModel
from typing import Optional

class RagFileResponse(BaseModel):
    """
    文件上传/列表响应模型
    用于前端 Sidebar 展示文件列表
    """
    id: str
    name: str
    size: int
    status: str  # enum: "indexed" | "uploading" | "error"
    upload_time: str

class RagDeleteResponse(BaseModel):
    """删除操作响应"""
    id: str
    status: str