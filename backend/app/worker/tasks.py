"""异步任务处理文件 - 定义Celery任务函数和PPT生成流程"""

from celery import Task
from app.core.celery_app import celery_app
from app.services.outline import create_outline_generator
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter


class PPTGenerationTask(Task):
    """PPT生成任务基类"""
    
    def __init__(self):
        super().__init__()
        self.outline_generator = None
        self.template_engine = None
        
    def initialize_services(self):
        """初始化服务实例"""
        if not self.outline_generator:
            self.outline_generator = create_outline_generator()
        if not self.template_engine:
            self.template_engine = TemplateEngine(PPTExporter())


@celery_app.task(bind=True, base=PPTGenerationTask)
def generate_ppt_task(self, user_prompt: str):
    """异步PPT生成任务"""
    self.initialize_services()
    
    # 更新任务状态
    self.update_state(state='PROGRESS', meta={'status': '正在生成大纲...'})
    
    # 生成大纲
    outline_result = self.outline_generator.generate_outline(user_prompt)
    if outline_result["status"] == "error":
        return {"status": "error", "error": outline_result["error"]}
    
    # 更新任务状态
    self.update_state(state='PROGRESS', meta={'status': '正在生成内容...'})
    
    # 生成完整PPT
    ppt_result = self.outline_generator.generate_complete_ppt(
        user_prompt, self.template_engine
    )
    
    # 更新任务状态
    self.update_state(state='PROGRESS', meta={'status': '正在导出文件...'})
    
    if ppt_result["status"] == "success":
        self.update_state(state='SUCCESS', meta={'result': ppt_result})
        return ppt_result
    else:
        self.update_state(state='FAILURE', meta={'error': ppt_result.get('error')})
        return ppt_result


@celery_app.task
def health_check_task():
    """健康检查任务"""
    return {"status": "healthy", "service": "chatppt-worker"}