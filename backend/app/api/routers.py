"""
任务路由定义文件 - 处理PPT生成任务的创建、状态查询和文件下载
(已修复 P1-P6: 可靠性、环境一致性、数据合约、文件系统猜测等问题)
"""

import os
from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
# FileResponse 用于将文件作为流式响应返回
from fastapi.responses import FileResponse

# 导入在 'app/schemas/task.py' 中定义的API数据合约
from app.schemas.task import TaskRequest, TaskResponse, TaskStatus, TaskResultData
from app.worker.tasks import generate_ppt_task

router = APIRouter()


@router.post("/tasks", response_model=TaskResponse)
def create_task(request: TaskRequest):
    """
    创建PPT生成任务 ("生产者" 端点)。
    职责：仅负责将任务提交到Broker。
    """
    
    # [P1 修复] 验证输入
    if not request.user_prompt:
        raise HTTPException(status_code=422, detail="user_prompt 不能为空")
    
    # [P1 修复] 捕获Broker连接错误
    try:
        # 将任务发送到Broker
        task = generate_ppt_task.delay(request.user_prompt)
        
        # 立即向客户端返回 "任务已创建" 的响应
        return TaskResponse(
            task_id=task.id,
            status=TaskStatus.PENDING,
            result=None
        )
    except Exception as e:
        # 如果 .delay() 失败 (例如 Redis 宕机)，返回 503 服务不可用
        raise HTTPException(status_code=503, detail=f"任务Broker连接失败: {str(e)}")


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_status(task_id: str):
    """
    查询任务状态 (轮询端点)。
    职责：仅负责从Backend查询并透明报告状态。
    """
    
    # [P2 修复] 移除了所有开发环境的模拟逻辑
    
    task_result = AsyncResult(task_id)
    state = task_result.state
    
    # 状态映射：将Celery的内部状态映射到API合约 (TaskStatus)
    if state == 'PENDING':
        status = TaskStatus.PENDING
    elif state == 'PROGRESS':
        status = TaskStatus.PROGRESS
    elif state == 'SUCCESS':
        status = TaskStatus.SUCCESS
    else:
        # 覆盖所有其他失败状态 (FAILURE, REVOKED, RETRY...)
        status = TaskStatus.FAILURE

    result_data = None
    if task_result.ready() and task_result.state == 'SUCCESS':
        # [P3 修复] 验证和解析结果，确保符合数据合约
        try:
            # task_result.result 是 worker 返回的原始字典
            # 我们将其解析为 TaskResultData 模型
            result_data = TaskResultData.model_validate(task_result.result)
        except Exception:
            # 如果Worker返回的数据不符合 TaskResultData 结构
            status = TaskStatus.FAILURE
            task_result._set_state('FAILURE') # 强制内部状态
            task_result.info = "任务结果无效: Worker返回的数据结构与Schema不匹配"

    return TaskResponse(
        task_id=task_id,
        status=status,
        # 仅当任务成功时才返回 *已验证* 的结果
        result=result_data,
        # 仅当任务失败时才返回错误信息
        error=str(task_result.info) if task_result.failed() else None
    )


@router.get("/tasks/{task_id}/file")
def download_ppt_file_direct(task_id: str):
    """(真正的) 直接下载PPT文件 (返回文件流)"""
    
    task_result = AsyncResult(task_id)
    
    if not task_result.ready():
        raise HTTPException(status_code=404, detail="任务未完成或不存在")
    
    if task_result.failed():
        raise HTTPException(status_code=500, detail=f"任务执行失败: {task_result.info}")
    
    result = task_result.result
    
    # [P4 修复] 验证数据合约
    # 1. 确保 result 是一个字典
    # 2. 检查的键现在是 'ppt_file_path' (来自 TaskResultData)
    if not isinstance(result, dict) or "ppt_file_path" not in result:
        raise HTTPException(status_code=500, detail="任务结果无效: 未在结果中找到 'ppt_file_path'")
    
    file_path = result["ppt_file_path"]
    
    # [P5 修复] 移除所有文件系统猜测逻辑
    # 我们现在 *信任* Worker 返回的 `file_path`
    
    # --- 生产级验证 ---
    # 1. 验证路径是否为绝对路径 (Worker必须返回绝对路径)
    if not file_path or not os.path.isabs(file_path):
        raise HTTPException(status_code=500, detail="任务结果无效: Worker返回的路径不是绝对路径")
    
    # 2. 验证文件是否真实存在于磁盘上
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="任务结果文件已丢失或不存在")
    
    # --- 安全地提供文件 ---
    filename = os.path.basename(file_path)
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )

# [P6 修复] 移除了多余的、令人困惑的 /tasks/{task_id}/download 端点