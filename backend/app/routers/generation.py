"""
[V2 重构] 对话式生成路由 (完全异步)

CTO注：此文件已完全重构。
所有端点现在都调用 Celery 异步任务 (高并发)，并立即返回 TaskResponse。
前端 (App.jsx) 现在必须轮询这些任务来获取 JSON 结果。
"""

from fastapi import APIRouter, HTTPException
import logging

# 1. 导入 Celery 任务
from app.worker.tasks import (
    generate_outline_conversational_task,
    generate_content_conversational_task,
    export_ppt_task,
)

# 2. 导入数据合约 (Schemas)
from app.schemas.task import (
    ConversationalOutlineRequest,
    ConversationalContentRequest,
    ExportRequest,
    TaskResponse,
    TaskStatus,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generation/outline_conversational", response_model=TaskResponse)
def async_generate_outline_conversational(request: ConversationalOutlineRequest):
    """
    [V2 异步节点 1]

    接收聊天历史，提交 *异步* 大纲生成任务。
    立即返回 TaskID 供前端轮询。
    """
    try:
        if not request.history:
            raise HTTPException(status_code=422, detail="'history' 不能为空")

        # 1. 提交给 Celery (非阻塞)
        task = generate_outline_conversational_task.delay(request.history)

        # 2. 立即返回 Task ID
        return TaskResponse(task_id=task.id, status=TaskStatus.PENDING, result=None)
    except Exception as e:
        logger.error(f"V2 异步大纲任务提交失败: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")


@router.post("/generation/content_conversational", response_model=TaskResponse)
def async_generate_content_conversational(request: ConversationalContentRequest):
    """
    [V2 异步节点 2]

    接收聊天历史和当前内容，提交 *异步* 内容修改任务。
    立即返回 TaskID 供前端轮询。
    """
    try:
        if not request.history:
            raise HTTPException(status_code=422, detail="'history' 不能为空")

        # 1. 提交给 Celery (非阻塞)
        task = generate_content_conversational_task.delay(
            request.history, request.current_slides
        )

        # 2. 立即返回 Task ID
        return TaskResponse(task_id=task.id, status=TaskStatus.PENDING, result=None)
    except Exception as e:
        logger.error(f"V2 异步内容任务提交失败: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")


@router.post("/generation/export", response_model=TaskResponse)
def async_export_ppt(request: ExportRequest):
    """
    [V2 异步节点 3 - 最终步骤] (此接口保持不变)

    接收最终确认的内容，将其 *交给Celery* 进行后台导出，
    并立即返回一个 task_id。
    """
    try:
        # 1. 提交给 Celery (非阻塞)
        task = export_ppt_task.delay(request.content)

        # 2. 立即返回 Task ID
        return TaskResponse(
            task_id=task.id, status=TaskStatus.PENDING, result=None, error=None
        )
    except Exception as e:
        # (这很可能是 Broker 连接错误)
        logger.error(f"V2 异步导出任务提交失败: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")
