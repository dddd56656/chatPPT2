"""
Celery Worker - IO 密集型任务执行者
"""
import os
import logging
from app.core.celery_app import celery_app
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter
from app.core.config import settings

logger = logging.getLogger(__name__)

# 初始化服务 (Worker 启动时执行一次)
try:
    exporter = PPTExporter()
    designer = TemplateEngine(exporter)
except Exception as e:
    logger.critical(f"Worker Init Failed: {e}")
    designer = None

@celery_app.task(name="chatppt.export_ppt")
def export_ppt_task(content_data: dict):
    """导出 PPT 的后台任务"""
    if not designer:
        return {"status": "error", "message": "Service not initialized"}
        
    try:
        title = content_data.get("title", "presentation")
        slides = content_data.get("slides_data", [])
        
        # 1. 生成 PPT 对象
        result = designer.create_from_template(title, slides)
        
        # 2. 写入磁盘
        filename = result['filename']
        file_path = os.path.join(settings.output_dir, filename)
        
        os.makedirs(settings.output_dir, exist_ok=True)
        
        with open(file_path, "wb") as f:
            f.write(result['buffer'].getvalue())
            
        return {
            "status": "success",
            "ppt_file_path": os.path.abspath(file_path),
            "message": "Export completed"
        }
    except Exception as e:
        logger.error(f"Export Task Failed: {e}")
        raise e
