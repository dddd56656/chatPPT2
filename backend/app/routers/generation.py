"""
[V3 重构] 流式生成路由 (FastAPI Native Async)

CTO注：
1. 废弃了 V2 的异步任务提交接口。
2. 新增 `/stream/...` 接口，使用 SSE (Server-Sent Events) 直接推送 LLM 生成的 Token。
3. 移除了 Celery 对文本生成的依赖，极大提高了并发处理能力。
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import logging
import json

# 导入 V3 服务
from app.services.outline import create_outline_generator
from app.services.content import ContentGeneratorV1
from app.schemas.task import (
    ConversationalOutlineRequest, 
    ConversationalContentRequest,
    ExportRequest,
    TaskResponse,
    TaskStatus
)
# 导入 Celery 任务 (仅用于导出)
from app.worker.tasks import export_ppt_task

router = APIRouter()
logger = logging.getLogger(__name__)

# 初始化服务单例
try:
    outline_generator = create_outline_generator()
    content_generator = ContentGeneratorV1()
except Exception as e:
    logger.error(f"Service Init Failed: {e}")
    # 生产环境中应采取更优雅的降级策略


@router.post("/stream/outline")
async def stream_generate_outline(request: ConversationalOutlineRequest):
    """
    [V3 SSE] 流式大纲生成
    """
    async def event_generator():
        try:
            # 调用 Service 的流式方法
            stream = outline_generator.generate_outline_stream(
                session_id=request.session_id,
                user_input=request.user_message
            )
            
            async for token in stream:
                # SSE 格式: data: <content>\n\n
                # 我们使用 JSON 包装以便前端解析
                payload = json.dumps({"text": token}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            
            # 结束标记
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Stream Error: {e}")
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.post("/stream/content")
async def stream_generate_content(request: ConversationalContentRequest):
    """
    [V3 SSE] 流式内容生成
    """
    async def event_generator():
        try:
            stream = content_generator.generate_content_stream(
                session_id=request.session_id,
                user_input=request.user_message,
                current_slides=request.current_slides
            )
            
            async for chunk in stream:
                payload = json.dumps({"text": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Stream Error: {e}")
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.post("/generation/export", response_model=TaskResponse)
def async_export_ppt(request: ExportRequest):
    """
    [V3 保留] 导出任务 (CPU/IO 密集型)
    依然使用 Celery 异步队列处理。
    """
    try:
        # 提交给 Celery
        task = export_ppt_task.delay(request.content)
        return TaskResponse(
            task_id=task.id, 
            status=TaskStatus.PENDING, 
            result=None
        )
    except Exception as e:
        logger.error(f"Export Task Failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Broker Error: {str(e)}")
