"""
异步任务路由 (V2 Polling)

CTO注：此文件是前端 `useTask` Hook 的轮询入口点。
[V2 重构]：移除了 V1 的 `create_task` 入口点。
此路由现在 *只* 负责 V2 流程的 "状态检查" 和 "文件下载"。
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Depends
from celery.result import AsyncResult
from fastapi.responses import FileResponse
from pydantic import ValidationError

# [V2 清理]：TaskRequest 已不再需要
from app.schemas.task import TaskResponse, TaskStatus, TaskResultData

# [V2 清理]：V1 workflow 任务已移除
# from app.worker.tasks import generate_ppt_workflow

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()


# [V2 清理]：移除 V1 (Batch) 模式的 API 入口点
# @router.post("/tasks", response_model=TaskResponse)
# def create_task(request: TaskRequest): ...


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_status(task_id: str):
    """
    查询任务状态 (用于前端轮询)。

    [CTO注]: 此端点无需更改。
    它现在轮询 V2 的三个独立任务 (`..._conversational_task`, `export_ppt_task`)。
    """
    task_result = AsyncResult(task_id)
    state = task_result.state

    # 将Celery状态映射到我们的Pydantic模型状态
    if state == "PENDING":
        status = TaskStatus.PENDING
    elif state == "PROGRESS":
        status = TaskStatus.PROGRESS
    elif state == "SUCCESS":
        status = TaskStatus.SUCCESS
    else:
        # 包括 'FAILURE', 'REVOKED', 'RETRY' 等
        status = TaskStatus.FAILURE

    task_result_data = None
    error_message = None

    if task_result.ready():
        if task_result.failed():
            # [CTO 修复]：失败的异常存储在 .result (或 .info, 取决于版本)，
            # .result 更可靠。
            error_message = str(task_result.result or task_result.info)

        elif task_result.successful():
            try:  # [CTO 修复] 1. 添加 'try'
                # [CTO 修复] 2. 修正 'task_result_data' 的缩进
                task_result_data = TaskResultData.model_validate(task_result.result)
            except ValidationError as e:  # [CTO 修复] 3. 修正 'except' 的缩进
                # [CTO 修复]：`_set_state` 不存在。
                # 路由的职责是 *报告* 失败，而不是 *修改* 任务状态。
                logging.warning(f"任务 {task_id} 成功, 但数据合约验证失败: {e}")
                status = TaskStatus.FAILURE
                error_message = f"Worker返回的数据结构与Schema不匹配: {e}"
                # task_result._set_state("FAILURE") # <-- 移除此行
            except Exception as e:  # [CTO 修复] 3. 修正 'except' 的缩进
                # [CTO 修复]：移除此处的 _set_state
                logging.error(f"任务 {task_id} 结果解析失败: {e}")
                status = TaskStatus.FAILURE
                error_message = f"任务结果解析失败: {e}"
                # task_result._set_state("FAILURE") # <-- 移除此行

    return TaskResponse(
        task_id=task_id,
        status=status,
        result=task_result_data,
        error=error_message,
    )


@router.get("/tasks/{task_id}/file")
def download_ppt_file_direct(task_id: str):
    """
    直接下载PPT文件。
    [CTO注]: 此端点 V2 流程的最后一步需要，保持不变。
    """
    task_result = AsyncResult(task_id)

    # 1. 验证任务是否 'ready' (完成)
    if not task_result.ready():
        raise HTTPException(status_code=404, detail="任务未完成或不存在")

    # 2. 验证任务是否 'failed' (失败)
    if task_result.failed():
        raise HTTPException(status_code=500, detail=f"任务执行失败: {task_result.info}")

    # 3. 验证结果是否为字典 (Data Contract)
    result = task_result.result
    if not isinstance(result, dict) or "ppt_file_path" not in result:
        logging.error(f"任务 {task_id} 结果无效: 缺少 'ppt_file_path'. 结果: {result}")
        raise HTTPException(
            status_code=500, detail="任务结果无效：未在结果中找到 'ppt_file_path'"
        )

    file_path = result["ppt_file_path"]

    # [CTO注]：V2 节点 1 和 2 会返回 None 路径，这是正常的。
    # 只有节点 3 (导出) 才会返回真实路径。
    if not file_path:
        raise HTTPException(
            status_code=404,
            detail="此任务无权下载文件 (例如：这是一个大纲或内容生成任务，而非导出任务)",
        )

    # 4. 验证路径的绝对性和存在性 (防止路径操纵和IO错误)
    if not os.path.isabs(file_path):
        logging.error(f"任务 {task_id} 路径无效: 路径不是绝对路径. 路径: {file_path}")
        raise HTTPException(
            status_code=500, detail="任务结果无效：文件路径不是绝对路径"
        )

    if not os.path.exists(file_path):
        logging.error(f"任务 {task_id} 文件丢失: 磁盘上未找到. 路径: {file_path}")
        raise HTTPException(status_code=404, detail="任务结果文件已丢失或不存在")

    # 5. 仅在所有检查通过后才返回 FileResponse
    filename = os.path.basename(file_path)

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
