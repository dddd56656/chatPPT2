"""
异步任务处理文件 - 定义Celery任务函数和PPT生成流程

此模块将原orchestrator.py的同步逻辑迁移为异步Celery任务
"""

import os
import logging
from typing import Dict, Any
from celery import Task
from app.core.celery_app import celery_app
from app.services.outline import OutlineGenerator, create_outline_generator
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter

# 配置日志
logger = logging.getLogger(__name__)

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
def generate_ppt_task(self, user_prompt: str) -> Dict[str, Any]:
    """
    异步PPT生成任务
    
    Args:
        user_prompt: 用户提示词
        
    Returns:
        包含生成结果的字典
    """
    logger.info(f"开始异步PPT生成任务，用户提示: {user_prompt}")
    
    try:
        # 初始化服务
        self.initialize_services()
        
        # 更新任务状态
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 1,
                'total': 4,
                'status': '正在生成大纲...'
            }
        )
        
        # 1. 生成大纲
        outline_result = self.outline_generator.generate_outline(user_prompt)
        if outline_result["status"] == "error":
            return {
                "status": "error",
                "error": outline_result["error"],
                "message": "大纲生成失败"
            }
        
        # 更新任务状态
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 2,
                'total': 4,
                'status': '正在生成内容...'
            }
        )
        
        # 2. 生成完整PPT
        ppt_result = self.outline_generator.generate_complete_ppt(
            user_prompt, self.template_engine
        )
        
        # 更新任务状态
        self.update_state(
            state='PROGRESS',
            meta={
                'current': 3,
                'total': 4,
                'status': '正在导出文件...'
            }
        )
        
        if ppt_result["status"] == "success":
            logger.info(f"PPT生成成功: {ppt_result['ppt_file']}")
            
            # 最终状态
            self.update_state(
                state='SUCCESS',
                meta={
                    'current': 4,
                    'total': 4,
                    'status': '生成完成',
                    'result': ppt_result
                }
            )
            
            return ppt_result
        else:
            logger.error(f"PPT生成失败: {ppt_result.get('error', '未知错误')}")
            
            self.update_state(
                state='FAILURE',
                meta={
                    'current': 4,
                    'total': 4,
                    'status': '生成失败',
                    'error': ppt_result.get('error', '未知错误')
                }
            )
            
            return ppt_result
            
    except Exception as e:
        logger.error(f"PPT生成任务异常: {e}")
        
        self.update_state(
            state='FAILURE',
            meta={
                'current': 4,
                'total': 4,
                'status': '任务异常',
                'error': str(e)
            }
        )
        
        return {
            "status": "error",
            "error": str(e),
            "message": "PPT生成任务异常"
        }

@celery_app.task
def health_check_task() -> Dict[str, Any]:
    """
    健康检查任务
    
    Returns:
        健康状态信息
    """
    return {
        "status": "healthy",
        "service": "chatppt-worker",
        "timestamp": "2025-01-01T00:00:00Z"
    }