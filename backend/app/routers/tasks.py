"""
[V3 API] 异步任务控制器
仅负责耗时的 IO/CPU 操作（如 PPT 导出）
"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from celery.result import AsyncResult
from app.worker.tasks import export_ppt_task
from app.schemas.task import ExportRequest, TaskResponse, TaskStatus, TaskResultData

router = APIRouter()

@router.post("/generation/export", response_model=TaskResponse)
def create_export_task(request: ExportRequest):
    """提交导出任务到 Celery"""
    try:
        task = export_ppt_task.delay(request.content)
        return TaskResponse(task_id=task.id, status=TaskStatus.PENDING)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_status(task_id: str):
    """轮询任务状态"""
    result = AsyncResult(task_id)
    
    # 映射 Celery 状态到 API 状态
    status = TaskStatus.PENDING
    if result.state == 'SUCCESS': status = TaskStatus.SUCCESS
    elif result.state == 'FAILURE': status = TaskStatus.FAILURE
    
    data = None
    if result.ready() and result.successful():
        # 严格验证返回数据
        try:
            data = TaskResultData(**result.result)
        except:
            status = TaskStatus.FAILURE
            
    return TaskResponse(
        task_id=task_id,
        status=status,
        result=data,
        error=str(result.info) if result.failed() else None
    )

@router.get("/tasks/{task_id}/file")
def download_task_file(task_id: str):
    """下载生成的文件"""
    result = AsyncResult(task_id)
    if not result.ready():
        raise HTTPException(status_code=404, detail="Task not ready")
    
    if result.failed() or not result.result:
        raise HTTPException(status_code=500, detail="Task failed")
        
    file_path = result.result.get('ppt_file_path')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
