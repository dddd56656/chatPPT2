"""
[V3 API] 流式生成控制器
"""
import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.services.outline import create_outline_generator
from app.services.content import ContentGeneratorV1
# [CTO Note]: Import updated from 'task' to 'generation'
from app.schemas.generation import ConversationalOutlineRequest, ConversationalContentRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# 全局变量预定义
outline_service = None
content_service = None

# 初始化服务 (带容错)
try:
    outline_service = create_outline_generator()
    content_service = ContentGeneratorV1()
    logger.info("AI Services Initialized Successfully.")
except Exception as e:
    logger.critical(f"Service Init Failed: {e}")

@router.post("/stream/outline")
async def stream_outline(request: ConversationalOutlineRequest):
    """SSE: 大纲生成"""
    if not outline_service:
        raise HTTPException(
            status_code=503, 
            detail="AI Service Unavailable. Please check backend logs."
        )

    async def _generator():
        stream = outline_service.generate_outline_stream(
            session_id=request.session_id, user_input=request.user_message
        )
        async for token in stream:
            payload = json.dumps({"text": token}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_generator(), media_type="text/event-stream")

@router.post("/stream/content")
async def stream_content(request: ConversationalContentRequest):
    """SSE: 内容生成"""
    if not content_service:
        raise HTTPException(
            status_code=503, 
            detail="AI Service Unavailable. Please check backend logs."
        )

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
