"""
异步任务处理文件 - [V2 专注模式]

CTO 注释 (Google SRE 标准):
[V2 重构]：已移除所有 V1 (Batch) 相关的任务。
此文件现在 *只* 包含 V2 (Conversational) 流程所需的
独立、解耦的异步任务。
"""

import os
import logging
from celery import Task
from app.core.celery_app import celery_app

# 导入所有需要的服务
from app.services.outline import create_outline_generator
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter
from app.services.content import ContentGeneratorV1
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# --- 服务初始化 ---
try:
    outline_generator = create_outline_generator()
    exporter_service = PPTExporter()
    template_engine = TemplateEngine(exporter_service)
    # [CTO 修复]：ContentGeneratorV1 不再需要 template_engine
    content_generator = ContentGeneratorV1()
except Exception as e:
    logging.critical(f"Worker 服务初始化失败: {e}", exc_info=True)
    outline_generator = None
    template_engine = None
    content_generator = None


# --- V2 (及 V1) 共用: 节点 3 (导出) ---
@celery_app.task(name="chatppt.export_ppt")
def export_ppt_task(content_result: dict) -> dict:
    """
    [V2 最终节点 3]
    接收 'content_result' (来自 V2 前端)，并导出PPT文件。
    此任务 *必须* 返回一个符合 TaskResultData 协定的字典。
    """
    if not template_engine:
        return {"status": "error", "error": "Template Engine 未初始化"}

    slides_data = content_result.get("slides_data")
    title = content_result.get("title", "presentation")

    if not slides_data:
        return {"status": "error", "error": "从节点2接收到无效的 slides_data"}

    try:
        # 1. TemplateEngine 负责将数据应用到模板
        ppt_export = template_engine.create_from_template(
            title=title, slides_data=slides_data
        )

        # 2. 此任务负责 IO 保存
        output_dir = settings.output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        filename = ppt_export.get("filename", f"{title.replace(' ', '_')}.pptx")
        file_path = os.path.abspath(os.path.join(output_dir, filename))

        buffer = ppt_export.get("buffer")
        if not buffer:
            raise ValueError("TemplateEngine 未返回有效的 buffer")

        buffer.seek(0)
        with open(file_path, "wb") as f:
            f.write(buffer.getvalue())

        logger.info(f"文件已成功保存到: {file_path}")

        # 此返回结构 *必须* 匹配 schemas/task.py 中的 TaskResultData
        return {
            "status": "success",
            "ppt_file_path": file_path,
            "message": f"PPT {title} 生成成功。",
            "outline": None, # V2 节点 3 不返回 outline
            "slides_data": None # V2 节点 3 不返回 slides_data
        }
    except Exception as e:
        logger.error(f"export_ppt_task 失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


# --- [V2 核心] 节点 1 - 对话式大纲 ---
@celery_app.task(name="chatppt.generate_outline_conversational")
def generate_outline_conversational_task(history: list) -> dict:
    """
    [V2 异步节点 1]
    由 generation.py (聊天路由) 调用。
    接收 *完整* 聊天记录，返回 *大纲JSON*。
    """
    if not outline_generator:
        logger.error("V2 任务失败: Outline Generator 未初始化")
        return {"status": "error", "error": "Outline Service not initialized"}

    try:
        # 调用 V2 的 `generate_outline_conversational` 方法
        result = outline_generator.generate_outline_conversational(history)
        if result.get("status") == "error":
             raise Exception(result.get("error", "LLM generation failed"))
        
        # [CTO 修复]：V2 任务也必须符合 TaskResultData 协定
        return {
            "status": "success",
            "ppt_file_path": None, # V2 节点1/2 没有文件路径
            "message": "大纲生成成功",
            "outline": result, # 将大纲数据嵌套在 'outline' 键中
            "slides_data": None
        }
    except Exception as e:
        logger.error(f"V2 异步大纲任务失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


# --- [V2 核心] 节点 2 - 对话式内容 ---
@celery_app.task(name="chatppt.generate_content_conversational")
def generate_content_conversational_task(history: list, current_slides: list) -> dict:
    """
    [V2 异步节点 2]
    由 generation.py (聊天路由) 调用。
    接收 *完整* 聊天记录和 *当前幻灯片*，返回 *新的幻灯片JSON*。
    """
    if not content_generator:
        logger.error("V2 任务失败: Content Generator 未初始化")
        return {"status": "error", "error": "Content Service not initialized"}

    try:
        # 调用 V2 的 `generate_content_conversational` 方法
        slides_data = content_generator.generate_content_conversational(
            history, current_slides
        )

        # [CTO 修复]：V2 任务也必须符合 TaskResultData 协定
        return {
            "status": "success",
            "ppt_file_path": None, # V2 节点1/2 没有文件路径
            "message": "内容生成成功",
            "outline": None,
            "slides_data": slides_data # 将幻灯片数据嵌套在 'slides_data' 键中
        }
    except Exception as e:
        logger.error(f"V2 异步内容任务失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
