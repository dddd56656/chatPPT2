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
from app.worker.tasks import outline_generator, template_engine, content_generator

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
    
    [CTO 修复]: 此端点逻辑已实现。
    """
    try:
        # [CTO 修复] 检查 content_generator 是否已初始化
        if not content_generator:
            raise HTTPException(status_code=503, detail="Content Generator 未初始化")
        
        # [CTO 修复] 从 request.outline (这是一个字典) 中提取所需参数
        # (request.outline 对应前端的 finalOutline 对象)
        outline_data = request.outline
        main_topic = outline_data.get("main_topic")
        outline_list = outline_data.get("outline")
        summary_topic = outline_data.get("summary_topic")

        if not all([main_topic, outline_list, summary_topic]):
            logger.warning(f"sync_generate_content 收到无效的大纲数据: {outline_data}")
            raise HTTPException(status_code=422, detail="收到无效或不完整的大纲数据")

        # [CTO 修复] 调用 V1 内容生成器服务 (同步)
        # 注意：我们忽略了 request.user_prompt (例如 "开始生成")
        # 因为 V1 服务 (generate_ppt_data_v1) 只需要大纲。
        slides_data = content_generator.generate_ppt_data_v1(
            main_topic=main_topic,
            outline=outline_list,
            summary_topic=summary_topic
        )
        
        # [CTO 修复] 检查 content_generator 的 V1 服务是否返回了回退数据
        # (generate_ppt_data_v1 在失败时不会抛出异常, 而是返回回退数据)
        if not slides_data or slides_data[0].get("title", "").endswith("(回退数据)"):
             return ContentResponse(
                status="error", 
                content={}, 
                error="内容生成失败 (可能由LLM API引起)"
            )
            
        # [CTO 修复] 构造 Node 2 的标准输出
        # 这与 worker/tasks.py 中 Node 2 的输出结构一致
        content_result = {
            "title": main_topic, # 将标题也传递下去
            "slides_data": slides_data # 传递幻灯片列表
        }
            
        # [CTO 修复] 返回成功响应，'content' 键包含 *完整的* 幻灯片数据
        # 以便前端可以解析它，并为 Node 3 (export) 做准备。
        return ContentResponse(
            status="success",
            content=content_result, # <--- 传递这个字典
            error=None
        )
        
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
