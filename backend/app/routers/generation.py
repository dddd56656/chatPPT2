"""
[新] 同步/迭代式生成路由

CTO注：此文件用于 "聊天式" 交互。
它绕过了 `generate_ppt_workflow` 编排器，
而是直接调用服务层 (Node 1, Node 2) 以获得即时响应，
仅在最后一步 (Node 3 导出) 才调用Celery。

这是一个有效的架构模式 (API Orchestration)。
"""

from fastapi import APIRouter, HTTPException
import logging

# --- [关键架构] ---
#
# 1. 导入 *服务* (用于同步调用)
#    我们直接从 tasks.py 导入全局服务实例
#    (CTO注: 在大型项目中，这应该来自一个专门的服务层)
from app.worker.tasks import outline_generator, template_engine

# 2. 导入 *Celery任务* (仅用于异步导出)
#    [CTO注]：我们调用的是 *修复后* 的 `export_ppt_task`
from app.worker.tasks import export_ppt_task

# 3. 导入 *数据合约*
from app.schemas.task import (
    OutlineRequest, OutlineResponse,
    ContentRequest, ContentResponse,
    ExportRequest, TaskResponse, TaskStatus
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generation/outline", response_model=OutlineResponse)
def sync_generate_outline(request: OutlineRequest):
    """
    [同步节点 1]
    
    接收提示词，立即返回大纲。
    用于聊天框的 "第一步"。
    """
    try:
        if not outline_generator:
            raise HTTPException(status_code=503, detail="Outline Generator 未初始化")
        
        # 直接调用服务 (同步)
        outline_result = outline_generator.generate_outline(request.user_prompt)
        
        if outline_result.get("status") == "error":
            return OutlineResponse(
                status="error", 
                outline={}, 
                error=outline_result.get("error", "生成大纲时出错")
            )
        
        # 立即返回大纲
        return OutlineResponse(
            status="success",
            outline=outline_result, # 假设 outline_result 包含大纲
            error=None
        )
    except Exception as e:
        logger.error(f"sync_generate_outline 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generation/content", response_model=ContentResponse)
def sync_generate_content(request: ContentRequest):
    """
    [同步节点 2]
    
    接收大纲 (可能已被聊天框修改) 和提示词，立即返回内容。
    
    [CTO注]: 此端点在您的原始代码中是缺失的，但对于
    一个完整的聊天流程是必需的。
    """
    try:
        # TODO: 此处应调用 *新* 的 Content Generator 服务
        # `outline_generator.generate_complete_ppt` 是一个单体服务
        # 您需要重构 `ContentGeneratorV1` 以便能在此处被独立调用。
        
        # 临时占位符
        raise HTTPException(status_code=501, detail="内容生成服务 (Node 2) 尚未实现")
        
        # 理想的调用方式:
        # if not content_generator:
        #     raise HTTPException(status_code=503, detail="Content Generator 未初始化")
        #
        # content_result = content_generator.generate_ppt_data_v1(
        #     main_topic=request.outline.get("main_topic", "Untitled"),
        #     outline=request.outline.get("outline", []),
        #     summary_topic=request.outline.get("summary_topic", "Summary")
        # )
        #
        # return ContentResponse(
        #     status="success",
        #     content=content_result, # 假设 content_result 是内容
        #     error=None
        # )
        
    except Exception as e:
        logger.error(f"sync_generate_content 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generation/export", response_model=TaskResponse)
def async_export_ppt(request: ExportRequest):
    """
    [异步节点 3 - 最终步骤]
    
    接收最终确认的内容，将其 *交给Celery* 进行后台导出，
    并立即返回一个 task_id。
    """
    try:
        if not template_engine:
            raise HTTPException(status_code=503, detail="Template Engine 未初始化")
        
        # --- 这是此路由中 *唯一* 的异步调用 ---
        # 我们将耗时的I/O操作 (文件导出) 交给Worker
        # [CTO注]：我们调用的是 *修复后* 的 `export_ppt_task`
        task = export_ppt_task.delay(request.content)
        
        # 立即返回 task_id，以便客户端可以开始轮询 /api/v1/tasks/{task_id}
        return TaskResponse(
            task_id=task.id,
            status=TaskStatus.PENDING,
            result=None,
            error=None
        )
    except Exception as e:
        # (这很可能是 Broker 连接错误)
        logger.error(f"async_export_ppt 失败: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")
