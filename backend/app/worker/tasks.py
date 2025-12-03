"""
异步任务处理文件 - [V3 IO/CPU 专用]

CTO 注释:
[V3 清理]：
1. 移除了所有文本生成相关的任务 (Outline/Content)，因为它们已迁移到 FastAPI Native Async 流式接口。
2. 仅保留 `export_ppt_task`，因为它是 CPU/IO 密集型操作，适合 Celery。
"""

import os
import logging
from celery import Task
from app.core.celery_app import celery_app
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter
from app.core.config import settings

logger = logging.getLogger(__name__)

# --- 服务初始化 (仅需导出相关) ---
try:
    exporter_service = PPTExporter()
    template_engine = TemplateEngine(exporter_service)
except Exception as e:
    logging.critical(f"Worker Export Service Init Failed: {e}", exc_info=True)
    template_engine = None


@celery_app.task(name="chatppt.export_ppt")
def export_ppt_task(content_result: dict) -> dict:
    """
    [V3 导出节点]
    接收内容数据，生成 PPT 文件。
    """
    if not template_engine:
        return {"status": "error", "error": "Template Engine 未初始化"}

    slides_data = content_result.get("slides_data")
    title = content_result.get("title", "presentation")

    if not slides_data:
        return {"status": "error", "error": "无效的 slides_data"}

    try:
        # 1. 应用模板
        ppt_export = template_engine.create_from_template(
            title=title, slides_data=slides_data
        )

        # 2. 保存文件
        output_dir = settings.output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        filename = ppt_export.get("filename", f"{title.replace(' ', '_')}.pptx")
        file_path = os.path.abspath(os.path.join(output_dir, filename))

        buffer = ppt_export.get("buffer")
        buffer.seek(0)
        with open(file_path, "wb") as f:
            f.write(buffer.getvalue())

        logger.info(f"Export Success: {file_path}")

        return {
            "status": "success",
            "ppt_file_path": file_path,
            "message": f"PPT {title} 生成成功。",
        }
    except Exception as e:
        logger.error(f"Export Failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
