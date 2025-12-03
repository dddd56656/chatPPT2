"""
[V3 API] 流式生成控制器
采用 Server-Sent Events (SSE) 标准
"""
import logging
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.outline import create_outline_generator
from app.services.content import ContentGeneratorV1
from app.schemas.task import ConversationalOutlineRequest, ConversationalContentRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# 初始化服务
try:
    outline_service = create_outline_generator()
    content_service = ContentGeneratorV1()
except Exception as e:
    logger.critical(f"Service Init Failed: {e}")

@router.post("/stream/outline")
async def stream_outline(request: ConversationalOutlineRequest):
    """SSE: 大纲生成"""
    async def _generator():
        stream = outline_service.generate_outline_stream(
            session_id=request.session_id,
            user_input=request.user_message
        )
        async for token in stream:
            # 构造符合 SSE 规范的数据块
            payload = json.dumps({"text": token}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_generator(), media_type="text/event-stream")

@router.post("/stream/content")
async def stream_content(request: ConversationalContentRequest):
    """SSE: 内容生成"""
    async def _generator():
        stream = content_service.generate_content_stream(
            session_id=request.session_id,
            user_input=request.user_message,
            current_slides=request.current_slides
        )
        async for token in stream:
            payload = json.dumps({"text": token}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_generator(), media_type="text/event-stream")
