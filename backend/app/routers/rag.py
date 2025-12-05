"""
RAG 路由模块 - 暴露知识库管理接口
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List

# 引入核心服务和数据契约
from app.services.rag import rag_service
from app.schemas.rag import RagFileResponse, RagDeleteResponse

router = APIRouter()

@router.post("/upload", response_model=RagFileResponse)
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    """
    上传文档接口
    - 接收 multipart/form-data 文件
    - 调用 Service 进行 ETL (解析->切分->向量化->入库)
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # 委派给核心服务处理
    # 注意：service 内部已实现 initialize 检查，未就绪会报错
    return await rag_service.handle_file_upload(file, session_id)

@router.get("/files", response_model=List[RagFileResponse])
def list_documents(session_id: str):
    """
    获取文件列表接口
    - 读取 JSON 元数据
    """
    return rag_service.list_files(session_id)

@router.delete("/files/{file_id}")
def delete_document(file_id: str):
    """
    删除文档接口
    - 从向量库中物理删除指定文件的所有切片
    """
    rag_service.delete_file(file_id)
    return RagDeleteResponse(id=file_id, status="deleted")