"""
异步任务处理文件 - [已重构为三节点工作流模式]

CTO注：这是项目的核心业务逻辑。
我已修复此文件，使其能正确调用服务层 (Services)，
解决了导致所有任务失败的严重架构缺陷。
"""

import os
import logging
from celery import Task
from app.core.celery_app import celery_app
# 导入所有需要的服务
from app.services.outline import create_outline_generator
from app.services.design import TemplateEngine
from app.services.exporter import PPTExporter
# [CTO 修复] 导入 V1 内容生成器
from app.services.content import ContentGeneratorV1
# [CTO 修复] 导入 settings 以获取 output_dir
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# --- 服务初始化 ---
# CTO注：这些服务在Worker启动时被创建为全局单例。
# 这要求它们必须是无状态且线程安全的。
try:
    outline_generator = create_outline_generator()
    exporter_service = PPTExporter()
    template_engine = TemplateEngine(exporter_service)
    # [CTO 修复] 初始化 V1 内容生成器
    content_generator = ContentGeneratorV1(template_engine)
except Exception as e:
    logging.critical(f"Worker 服务初始化失败: {e}", exc_info=True)
    outline_generator = None
    template_engine = None
    content_generator = None


# --- 节点 1: 大纲生成任务 ---
@celery_app.task(name="chatppt.generate_outline")
def generate_outline_task(user_prompt: str) -> dict:
    """
    [工作流节点 1]
    
    仅负责根据提示词生成大纲。
    """
    if not outline_generator:
        return {"status": "error", "error": "Outline Generator 未初始化"}
        
    try:
        # [CTO注]：此调用正确。outline_generator.generate_outline 
        # 返回一个包含大纲的字典。
        outline_result = outline_generator.generate_outline(user_prompt)
        return outline_result
    except Exception as e:
        logger.error(f"generate_outline_task 失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


# --- 节点 2: 内容生成任务 [已修复] ---
@celery_app.task(name="chatppt.generate_content")
def generate_content_task(outline_result: dict, user_prompt: str) -> dict:
    """
    [工作流节点 2]
    
    接收 'outline_result' (来自节点1)，并生成完整的PPT内容(尚未导出)。
    """
    if not content_generator:
        return {"status": "error", "error": "Content Generator 未初始化"}
    
    # 获取节点1传递过来的大纲
    outline_data = outline_result.get("outline")
    if not outline_data:
        return {"status": "error", "error": "从节点1接收到无效的大纲数据"}

    try:
        # --- [CTO 修复] ---
        # 错误：不再调用 `outline_generator.generate_complete_ppt` (单体)
        # 正确：调用 `content_generator.generate_ppt_data_v1`
        # -----------------
        slides_data = content_generator.generate_ppt_data_v1(
            main_topic=outline_result.get("main_topic", "Untitled"),
            outline=outline_data,
            summary_topic=outline_result.get("summary_topic", "Summary")
        )
        
        # 将此节点的结果传递给下一节点
        return {
            "status": "success",
            "title": outline_result.get("main_topic", "Untitled"),
            "slides_data": slides_data
        }
    except Exception as e:
        logger.error(f"generate_content_task 失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


# --- 节点 3: PPT 导出任务 [已修复] ---
@celery_app.task(name="chatppt.export_ppt")
def export_ppt_task(content_result: dict) -> dict:
    """
    [工作流节点 3]
    
    接收 'content_result' (来自节点2)，并使用 TemplateEngine 导出PPT文件。
    
    CTO注：此任务现在也用于 /generation/export 端点。
    它 *必须* 返回一个符合 TaskResultData 协定的字典。
    """
    if not template_engine:
        return {"status": "error", "error": "Template Engine 未初始化"}

    # 获取节点2传递过来的内容
    slides_data = content_result.get("slides_data")
    title = content_result.get("title", "presentation")
    
    if not slides_data:
        return {"status": "error", "error": "从节点2接收到无效的 slides_data"}

    try:
        # --- [CTO 修复] ---
        # 错误：`template_engine.export()` 不存在。
        # 正确：调用 `template_engine.create_from_template()`
        # -----------------
        ppt_export = template_engine.create_from_template(
            title=title, 
            slides_data=slides_data
        )
        
        # --- [CTO 修复] ---
        # 关键：工作流必须保存文件并返回 *路径*，
        # 而不是返回内存中的缓冲区。
        # (此逻辑复制自 'outline_generator' 中的 _save_ppt_file)
        # -----------------
        output_dir = settings.output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        filename = ppt_export.get("filename", f"{title.replace(' ', '_')}.pptx")
        # [CTO注]：必须是 *绝对* 路径，以便API端点可以安全地找到它
        file_path = os.path.abspath(os.path.join(output_dir, filename))
        
        buffer = ppt_export.get("buffer")
        if not buffer:
            raise ValueError("TemplateEngine 未返回有效的 buffer")
        
        buffer.seek(0)
        with open(file_path, "wb") as f:
            f.write(buffer.getvalue())
        
        logger.info(f"文件已成功保存到: {file_path}")

        # [CTO注]：此返回结构 *必须* 匹配 TaskResultData Schema
        return {
            "status": "success",
            "ppt_file_path": file_path,
            "message": f"PPT {title} 生成成功。"
        }
    except Exception as e:
        logger.error(f"export_ppt_task 失败: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}


# --- 编排器: 完整工作流任务 (已修复) ---
@celery_app.task(bind=True, name="chatppt.generate_ppt_workflow")
def generate_ppt_workflow(self: Task, user_prompt: str):
    """
    [API 入口点]
    
    编排整个三节点工作流 (1.大纲 -> 2.内容 -> 3.导出)
    """
    try:
        # --- 步骤 1: 调用大纲节点 ---
        self.update_state(state='PROGRESS', meta={'status': '正在生成大纲...'})
        # .s() 创建签名，.apply_async().get() 同步调用并等待结果
        outline_result = generate_outline_task.s(user_prompt).apply_async().get(timeout=300)
        
        if outline_result.get("status") == "error":
            raise Exception(f"大纲节点失败: {outline_result.get('error')}")

        # --- 步骤 2: 调用内容生成节点 [已修复] ---
        self.update_state(state='PROGRESS', meta={'status': '正在生成内容...'})
        # [CTO注]：将 user_prompt 和 outline_result 一起传递给 Node 2
        content_result = generate_content_task.s(outline_result, user_prompt).apply_async().get(timeout=600)
        
        if content_result.get("status") == "error":
            raise Exception(f"内容节点失败: {content_result.get('error')}")

        # --- 步骤 3: 调用导出节点 [已修复] ---
        self.update_state(state='PROGRESS', meta={'status': '正在导出文件...'})
        # [CTO注]：将 Node 2 的结果 (包含 title 和 slides_data) 传递给 Node 3
        final_result = export_ppt_task.s(content_result).apply_async().get(timeout=300)

        if final_result.get("status") == "error":
            raise Exception(f"导出节点失败: {final_result.get('error')}")

        # --- 工作流成功 ---
        # final_result 必须符合 TaskResultData Schema
        self.update_state(state='SUCCESS', meta={'result': final_result})
        return final_result

    except Exception as e:
        # --- 工作流失败 ---
        logger.error(f"generate_ppt_workflow (ID: {self.request.id}) 失败: {e}", exc_info=True)
        # [CTO注]：meta={...} 中必须包含 'error' 键，以便API端点可以读取它
        self.update_state(state='FAILURE', meta={'error': str(e)})
        # 也返回错误，以防此任务被同步调用
        return {"status": "error", "error": str(e)}


# --- 向后兼容任务 [已修复] ---
@celery_app.task(bind=True, name="app.worker.tasks.generate_ppt_task")
def generate_ppt_task(self: Task, user_prompt: str):
    """
    向后兼容任务 - 重定向到新的工作流任务
    用于处理队列中已有的旧任务
    
    [CTO 修复]：严重错误！
    原始代码中的 `.get()` 会导致任务 *阻塞* Worker 进程，
    如果新旧任务互相调用，将导致永久死锁 (Deadlock)。
    
    修复：我们调用新工作流，并返回其 *任务ID*。
    这是一个重定向，而不是一个阻塞调用。
    """
    logging.warning(f"检测到旧任务 (ID: {self.request.id})，重定向到 generate_ppt_workflow")
    
    # 异步调用新工作流
    new_task = generate_ppt_workflow.delay(user_prompt)
    
    # [CTO注]：我们不能阻塞 (.get())，但旧客户端可能期望一个结果。
    # 我们返回一个特殊的 "重定向" 字典。
    # 旧客户端的轮询逻辑 *应该* 失败（这是预期的）。
    return {
        "status": "redirected", 
        "new_task_id": new_task.id,
        "message": "Task format is deprecated and has been redirected."
    }


@celery_app.task
def health_check_task():
    """健康检查任务"""
    return {"status": "healthy", "service": "chatppt-worker"}
