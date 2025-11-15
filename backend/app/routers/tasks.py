"""
异步任务路由 (Batch Workflow)

CTO注：此文件是前端 "生成PPT" 按钮的后端入口。
它调用 *新* 的 `generate_ppt_workflow` 编排器任务。

[已修复] 我已对此文件进行了全面加固 (Hardening)，
以处理各种边界情况和运行时错误，确保API的可靠性。
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Depends
from celery.result import AsyncResult
from fastapi.responses import FileResponse
# [CTO 修复] 导入 Pydantic 验证错误
from pydantic import ValidationError

from app.schemas.task import TaskRequest, TaskResponse, TaskStatus, TaskResultData
# 导入新的 'workflow' 任务
from app.worker.tasks import generate_ppt_workflow

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/tasks", response_model=TaskResponse)
def create_task(request: TaskRequest):
    """
    创建PPT生成工作流 (Workflow)
    
    [CTO注]: 此端点调用 'generate_ppt_workflow' 编排器。
    """
    if not request.user_prompt:
        raise HTTPException(status_code=422, detail="user_prompt 不能为空")
        
    try:
        # 调用新的编排器任务
        task = generate_ppt_workflow.delay(request.user_prompt)
        
        return TaskResponse(
            task_id=task.id,
            status=TaskStatus.PENDING,
            result=None
        )
    # --- [CTO 修复 P1] ---
    # 明确捕获 Broker (例如Redis) 连接失败。
    # 'Exception' 太宽泛了。
    except ConnectionError as e:
        logger.error(f"任务创建失败: Broker 连接错误: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")
    except Exception as e:
        # 捕获其他意外错误
        logger.error(f"任务创建失败: 未知错误: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"任务创建失败: {str(e)}")


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_status(task_id: str):
    """
    查询任务状态 (用于前端轮询)。
    
    [CTO注]: 此端点无需更改。
    它现在轮询 'generate_ppt_workflow' 任务的状态。
    """
    task_result = AsyncResult(task_id)
    state = task_result.state
    
    # 将Celery状态映射到我们的Pydantic模型状态
    if state == 'PENDING':
        status = TaskStatus.PENDING
    elif state == 'PROGRESS':
        status = TaskStatus.PROGRESS
    elif state == 'SUCCESS':
        status = TaskStatus.SUCCESS
    else:
        # 包括 'FAILURE', 'REVOKED', 'RETRY' 等
        status = TaskStatus.FAILURE

    # --- [CTO 修复 P3] ---
    # 安全地处理 'result' 和 'error' 字段，
    # 并验证数据合约 (Data Contract)。
    # ---------------------
    task_result_data = None
    error_message = None
    
    if task_result.ready():
        if task_result.failed():
            # 任务失败，从 task_result.info 获取 'FAILURE' 状态的错误信息
            error_message = str(task_result.info)
        
        elif task_result.successful():
            # 任务成功，验证 'SUCCESS' 状态的结果是否符合我们的数据合约
            try:
                # 尝试将Celery返回的 (dict) 解析为我们的 Pydantic 模型
                task_result_data = TaskResultData.model_validate(task_result.result)
            except ValidationError as e:
                # 关键：如果 Worker 返回的数据结构不匹配
                logging.warning(f"任务 {task_id} 成功, 但数据合约验证失败: {e}")
                # 强制将API状态改为 FAILURE
                status = TaskStatus.FAILURE
                error_message = f"Worker返回的数据结构与Schema不匹配: {e}"
                # (可选) 在后台将任务状态设置为 FAILURE
                task_result._set_state('FAILURE')
            except Exception as e:
                # 其他意外的解析错误
                logging.error(f"任务 {task_id} 结果解析失败: {e}")
                status = TaskStatus.FAILURE
                error_message = f"任务结果解析失败: {e}"
                task_result._set_state('FAILURE')

    return TaskResponse(
        task_id=task_id,
        status=status,
        result=task_result_data,  # 仅在验证成功时才返回
        error=error_message       # 仅在失败或验证失败时返回
    )


@router.get("/tasks/{task_id}/file")
def download_ppt_file_direct(task_id: str):
    """
    直接下载PPT文件。
    
    [CTO注]: 这是一个高风险端点，已进行全面加固。
    """
    task_result = AsyncResult(task_id)
    
    # --- [CTO 修复 P4] ---
    # 验证任务是否 'ready' (完成)
    if not task_result.ready():
        raise HTTPException(status_code=404, detail="任务未完成或不存在")
    
    # 验证任务是否 'failed' (失败)
    if task_result.failed():
        raise HTTPException(status_code=500, detail=f"任务执行失败: {task_result.info}")
    
    # --- [CTO 修复 P5] ---
    # 验证结果是否为字典 (Data Contract)
    result = task_result.result
    if not isinstance(result, dict) or "ppt_file_path" not in result:
        logging.error(f"任务 {task_id} 结果无效: 缺少 'ppt_file_path'. 结果: {result}")
        raise HTTPException(status_code=500, detail="任务结果无效：未在结果中找到 'ppt_file_path'")
        
    file_path = result["ppt_file_path"]
    
    # --- [CTO 修复 P6] ---
    # 验证路径的绝对性和存在性 (防止路径操纵和IO错误)
    if not file_path or not os.path.isabs(file_path):
        logging.error(f"任务 {task_id} 路径无效: 路径不是绝对路径. 路径: {file_path}")
        raise HTTPException(status_code=500, detail="任务结果无效：文件路径不是绝对路径")
        
    if not os.path.exists(file_path):
        logging.error(f"任务 {task_id} 文件丢失: 磁盘上未找到. 路径: {file_path}")
        raise HTTPException(status_code=404, detail="任务结果文件已丢失或不存在")
    
    # 仅在所有检查通过后才返回 FileResponse
    filename = os.path.basename(file_path)
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
