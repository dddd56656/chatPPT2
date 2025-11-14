"""
异步任务处理文件 - 定义Celery任务函数和PPT生成流程
(已修复 P1:效率, P2:状态, P3:可靠性 问题)
"""

# [P3 修复] 导入 traceback 以便在意外异常时记录完整的堆栈信息
import traceback
from celery import Task
from app.core.celery_app import celery_app
from app.services.outline import create_outline_generator
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter

# --- [P1 修复] 服务在模块全局范围内初始化 ---
#
# 服务在此处（模块全局范围）创建。
# 当Celery Worker进程启动时，它会导入此文件一次，
# 这将创建这些服务的 *单个* 实例。
# 所有后续的任务（成百上千个）都将 *复用* 这些实例。
#
# 警告：这要求 `outline_generator` 和 `template_engine` 必须是
# 线程安全 (thread-safe) 或无状态 (stateless) 的。
#
try:
    outline_generator = create_outline_generator()
    template_engine = TemplateEngine(PPTExporter())
except Exception as e:
    # 如果服务在启动时初始化失败，Worker将无法启动，
    # 立即在日志中暴露问题，这是正确的“快速失败”行为。
    print(f"FATAL: Worker服务初始化失败: {e}")
    outline_generator = None
    template_engine = None


# 移除了有问题的 `PPTGenerationTask` 基类
@celery_app.task(
    # bind=True 仍然是必需的，以便我们可以访问 `self.update_state`
    bind=True
)
def generate_ppt_task(self: Task, user_prompt: str):
    """
    异步PPT生成的主任务。
    """
    
    # [P3 修复] 将所有逻辑包裹在 try/except 块中，以捕获意外异常
    try:
        # 检查服务是否在Worker启动时成功初始化
        if not outline_generator or not template_engine:
            raise RuntimeError("Worker服务未成功初始化，无法执行任务。")

        # --- 步骤 1: 生成大纲 ---
        self.update_state(state='PROGRESS', meta={'status': '正在生成大纲...'})
        
        outline_result = outline_generator.generate_outline(user_prompt)
        
        # [P2 修复] 当业务逻辑返回错误时，
        # 必须先更新状态为 'FAILURE'，然后再返回。
        if outline_result.get("status") == "error":
            error_msg = outline_result.get("error", "大纲生成失败")
            self.update_state(state='FAILURE', meta={'error': error_msg})
            return {"status": "error", "error": error_msg}
        
        # --- 步骤 2: 生成完整内容 ---
        self.update_state(state='PROGRESS', meta={'status': '正在生成内容...'})
        
        ppt_result = outline_generator.generate_complete_ppt(
            user_prompt, template_engine
        )
        
        # --- 步骤 3: 导出和完成 ---
        self.update_state(state='PROGRESS', meta={'status': '正在导出文件...'})
        
        if ppt_result.get("status") == "success":
            # 任务成功
            self.update_state(state='SUCCESS', meta={'result': ppt_result})
            return ppt_result
        else:
            # 业务逻辑返回失败
            error_msg = ppt_result.get("error", "PPT生成失败")
            self.update_state(state='FAILURE', meta={'error': error_msg})
            return {"status": "error", "error": error_msg}

    except Exception as e:
        # [P3 修复] 捕获所有 *意外* 异常 (例如网络超时, IO错误, Bug)
        # 这可以防止Worker因未处理的异常而崩溃。
        error_msg = f"任务意外失败: {str(e)}"
        full_traceback = traceback.format_exc()
        
        # 将详细的堆栈跟踪记录到 'meta' 中，以便调试
        self.update_state(
            state='FAILURE', 
            meta={
                'error': error_msg,
                'traceback': full_traceback
            }
        )
        
        # 以字典形式返回错误，Celery会将其标记为 'FAILURE'
        return {"status": "error", "error": error_msg, "traceback": full_traceback}


@celery_app.task
def health_check_task():
    """
    健康检查任务。
    用于监控系统(如K8s)调用，以验证Broker和Worker是否存活。
    """
    # [P1 修复] 也可以在这里添加对全局服务的检查
    if outline_generator and template_engine:
        return {"status": "healthy", "service": "chatppt-worker", "services": "online"}
    else:
        # 如果服务未初始化，返回不健康状态
        return {"status": "unhealthy", "service": "chatppt-worker", "services": "offline"}