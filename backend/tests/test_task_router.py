"""
Pytest 单元测试文件 for app/routers/tasks.py

[CTO注]：此测试文件已全面修复。
1. 修复了所有 `patch()` 的导入路径。
2. 将测试目标从旧的 `generate_ppt_task` 切换为新的 `generate_ppt_workflow`。
3. 修复了 `mock_async_result_factory` 以正确模拟 `info` 和 `failed()`。
4. 添加了对 Pydantic `ValidationError` (数据合约失败) 的测试。
5. 修复了 `os.path` 模拟逻辑。
"""

import pytest
import os # [CTO 修复] 导入 os
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
# [CTO 修复] 导入 pydantic 验证错误
from pydantic import ValidationError

# [CTO 修复] 导入正确的路由模块 (来自 app/routers/tasks.py)
from app.routers.tasks import router as task_router
from app.schemas.task import TaskStatus, TaskResultData

# --- 测试设置 (Setup) ---

app = FastAPI()
# [CTO 修复] 确保前缀与 main.py 一致
app.include_router(task_router, prefix="/api/v1")
client = TestClient(app)

# --- Pytest Fixtures (模拟工具) ---

@pytest.fixture
def mock_async_result_factory():
    """
    [CTO 修复] Pytest Fixture: 工厂函数，用于创建模拟 AsyncResult。
    已修复 `info` 和 `failed` 的模拟逻辑。
    """
    def _factory(state: str, result=None, ready: bool = False, failed: bool = False, info=None):
        mock_res = MagicMock()
        mock_res.state = state
        mock_res.result = result
        
        # [CTO 修复] Celery将错误信息存储在 info 属性中
        mock_res.info = info if failed else (result if isinstance(result, Exception) else None)
        
        mock_res.ready.return_value = ready
        mock_res.failed.return_value = failed
        
        # 模拟 _set_state (用于 get_task_status 中的错误处理)
        mock_res._set_state = MagicMock()
        return mock_res
    return _factory


@pytest.fixture(autouse=True)
def patch_celery_async_result():
    """
    (Autouse=True) 自动模拟 `AsyncResult`。
    [CTO 修复] 模拟 `app.routers.tasks.AsyncResult`
    """
    with patch("app.routers.tasks.AsyncResult") as mock_async:
        yield mock_async


@pytest.fixture(autouse=True)
def patch_celery_task_delay():
    """
    (Autouse=True) 自动模拟 `generate_ppt_workflow.delay`。
    [CTO 修复] 模拟 `app.routers.tasks.generate_ppt_workflow.delay`
    """
    with patch("app.routers.tasks.generate_ppt_workflow.delay") as mock_delay:
        mock_task_obj = MagicMock()
        mock_task_obj.id = "mocked-task-id-12345"
        mock_delay.return_value = mock_task_obj
        yield mock_delay


# --- 测试用例 (Test Cases) ---

### 1. 测试 POST /api/v1/tasks (创建任务)

def test_create_task_success(patch_celery_task_delay):
    """
    测试: 成功创建一个任务
    验证: 状态码 200, 响应体, 以及 `generate_ppt_workflow.delay()` 被正确调用
    """
    response = client.post(
        "/api/v1/tasks",
        json={"user_prompt": "Test Prompt"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "mocked-task-id-12345"
    assert data["status"] == TaskStatus.PENDING
    assert data["result"] is None
    
    # 验证模拟的 .delay() 被以正确的参数调用
    patch_celery_task_delay.assert_called_once_with("Test Prompt")

def test_create_task_empty_prompt():
    """
    测试: 提交一个空的 prompt (P1 修复验证)
    验证: API返回 422 Unprocessable Entity
    """
    response = client.post(
        "/api/v1/tasks",
        json={"user_prompt": ""}
    )
    assert response.status_code == 422

def test_create_task_broker_connection_error(patch_celery_task_delay):
    """
    测试: Celery Broker连接失败 (P1 修复验证)
    验证: 捕获 ConnectionError 并返回 503
    """
    patch_celery_task_delay.side_effect = ConnectionError("Broker unreachable")
    
    response = client.post(
        "/api/v1/tasks",
        json={"user_prompt": "Test Prompt"}
    )
    
    assert response.status_code == 503
    assert "Broker连接失败" in response.json()["detail"]


### 2. 测试 GET /api/v1/tasks/{task_id} (查询状态)

@pytest.mark.parametrize(
    "celery_state, is_ready, is_failed, expected_status",
    [
        ("PENDING", False, False, TaskStatus.PENDING),
        ("PROGRESS", False, False, TaskStatus.PROGRESS),
        ("FAILURE", True, True, TaskStatus.FAILURE),
        ("REVOKED", True, True, TaskStatus.FAILURE), # 确保其他失败状态也被映射
    ]
)
def test_get_task_status_non_success(
    patch_celery_async_result,
    mock_async_result_factory,
    celery_state, is_ready, is_failed, expected_status
):
    """测试: 任务状态轮询 (非成功状态的参数化测试)"""
    mock_result = mock_async_result_factory(
        state=celery_state, 
        ready=is_ready, 
        failed=is_failed,
        info="Some error" if is_failed else None
    )
    patch_celery_async_result.return_value = mock_result
    
    response = client.get("/api/v1/tasks/mocked-task-id")
    
    assert response.status_code == 200
    patch_celery_async_result.assert_called_once_with("mocked-task-id")
    
    data = response.json()
    assert data["task_id"] == "mocked-task-id"
    assert data["status"] == expected_status
    assert data["result"] is None # 非成功状态不应有 result
    if is_failed:
        assert data["error"] == "Some error"

def test_get_task_status_success_valid_result(
    patch_celery_async_result,
    mock_async_result_factory
):
    """
    测试: 任务成功 (SUCCESS) 且 Worker 返回了 *有效* 的数据 (P3 修复验证)
    验证: 响应状态为 SUCCESS 且 result 字段被正确解析
    """
    valid_celery_payload = {
        "status": "success",
        "ppt_file_path": "/app/output/real.pptx",
        "message": "OK"
    }
    mock_result = mock_async_result_factory(
        state="SUCCESS", 
        result=valid_celery_payload,
        ready=True,
        failed=False
    )
    patch_celery_async_result.return_value = mock_result
    
    response = client.get("/api/v1/tasks/mocked-task-id")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == TaskStatus.SUCCESS
    
    # 验证 result 字段已从字典被Pydantic模型 (TaskResultData) 解析
    assert data["result"]["ppt_file_path"] == "/app/output/real.pptx"
    assert data["result"]["message"] == "OK"
    assert data["error"] is None

def test_get_task_status_success_invalid_result_validation_error(
    patch_celery_async_result,
    mock_async_result_factory
):
    """
    测试: 任务成功 (SUCCESS) 但 Worker 返回了 *无效* 的数据 (P3 修复验证)
    验证: API 捕获 ValidationError, 将状态强制改为 FAILURE
    """
    # 准备 (Arrange): 载荷中缺少 'ppt_file_path'
    invalid_celery_payload = {
        "status": "success",
        "message": "Missing file path"
    }
    mock_result = mock_async_result_factory(
        state="SUCCESS",
        result=invalid_celery_payload,
        ready=True,
        failed=False
    )
    
    # [CTO 修复] 模拟 Pydantic 验证失败
    # 我们 patch `TaskResultData.model_validate` 来抛出错误
    with patch("app.routers.tasks.TaskResultData.model_validate", side_effect=ValidationError.from_exception_data("Test Validation Error", [])):
        # 当 _set_state 被调用时，更新 failed() 的返回值
        def failed_side_effect():
            return mock_result._set_state.called and mock_result._set_state.call_args[0][0] == 'FAILURE'
        mock_result.failed.side_effect = failed_side_effect
        
        patch_celery_async_result.return_value = mock_result

        # 动作 (Act)
        response = client.get("/api/v1/tasks/mocked-task-id")

    # 断言 (Assert)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == TaskStatus.FAILURE
    assert data["result"] is None
    assert "Worker返回的数据结构与Schema不匹配" in data["error"]
    
    # 验证内部状态被修改
    mock_result._set_state.assert_called_once_with('FAILURE')


### 3. 测试 GET /api/v1/tasks/{task_id}/file (下载文件)

def test_download_file_direct_not_ready(patch_celery_async_result, mock_async_result_factory):
    """测试: 尝试下载一个尚未准备好的任务 (P4 验证) -> 404"""
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="PROGRESS", ready=False
    )
    response = client.get("/api/v1/tasks/mocked-task-id/file")
    assert response.status_code == 404
    assert "任务未完成" in response.json()["detail"]

def test_download_file_direct_task_failed(patch_celery_async_result, mock_async_result_factory):
    """测试: 尝试下载一个已失败的任务 (P4 验证) -> 500"""
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="FAILURE", info="Task failed badly", ready=True, failed=True
    )
    response = client.get("/api/v1/tasks/mocked-task-id/file")
    assert response.status_code == 500
    assert "任务执行失败: Task failed badly" in response.json()["detail"]

def test_download_file_direct_invalid_result_format(patch_celery_async_result, mock_async_result_factory):
    """测试: 任务成功, 但Worker返回了无效的结果 (P5 验证) -> 500"""
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="SUCCESS", result={"wrong_key": "data"}, ready=True
    )
    response = client.get("/api/v1/tasks/mocked-task-id/file")
    assert response.status_code == 500
    assert "未在结果中找到 'ppt_file_path'" in response.json()["detail"]

def test_download_file_direct_invalid_path_relative(patch_celery_async_result, mock_async_result_factory):
    """测试: 任务成功, 但Worker返回了一个相对路径 (P6 验证) -> 500"""
    file_path = "relative/path.pptx"
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="SUCCESS", result={"ppt_file_path": file_path}, ready=True
    )
    
    # [CTO 修复] 模拟 os.path.isabs
    with patch("app.routers.tasks.os.path.isabs", return_value=False) as mock_isabs:
        response = client.get("/api/v1/tasks/mocked-task-id/file")
        mock_isabs.assert_called_once_with(file_path)
    
    assert response.status_code == 500
    assert "路径不是绝对路径" in response.json()["detail"]

def test_download_file_direct_file_not_exist_on_disk(patch_celery_async_result, mock_async_result_factory):
    """测试: 任务成功, 路径有效, 但文件在磁盘上不存在 (P6 验证) -> 404"""
    file_path = "/tmp/absolute/path/to/missing_file.pptx"
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="SUCCESS", result={"ppt_file_path": file_path}, ready=True
    )
    
    # [CTO 修复] 模拟 os.path.isabs 和 os.path.exists
    with patch("app.routers.tasks.os.path.isabs", return_value=True) as mock_isabs:
        with patch("app.routers.tasks.os.path.exists", return_value=False) as mock_exists:
            response = client.get("/api/v1/tasks/mocked-task-id/file")
            mock_isabs.assert_called_once_with(file_path)
            mock_exists.assert_called_once_with(file_path) 
    
    assert response.status_code == 404
    assert "文件已丢失" in response.json()["detail"]

def test_download_file_direct_success(patch_celery_async_result, mock_async_result_factory):
    """测试: 完整成功的下载流程"""
    file_path = "/tmp/absolute/path/to/real_file.pptx"
    patch_celery_async_result.return_value = mock_async_result_factory(
        state="SUCCESS", result={"ppt_file_path": file_path}, ready=True
    )
    
    # [CTO 修复] 模拟所有 os.path 调用和 FileResponse
    with patch("app.routers.tasks.os.path.isabs", return_value=True) as mock_isabs:
        with patch("app.routers.tasks.os.path.exists", return_value=True) as mock_exists:
            with patch("app.routers.tasks.os.path.basename", return_value="real_file.pptx") as mock_basename:
                # 关键: 模拟 FileResponse 以避免实际的文件读取
                with patch("app.routers.tasks.FileResponse") as mock_file_response:
                    mock_file_response.return_value = MagicMock(status_code=200, content=b"file content")
                    
                    response = client.get("/api/v1/tasks/mocked-task-id/file")

    assert response.status_code == 200
    
    mock_isabs.assert_called_once_with(file_path)
    mock_exists.assert_called_once_with(file_path)
    mock_basename.assert_called_once_with(file_path)
    
    # 验证 FileResponse 被以正确的参数调用
    mock_file_response.assert_called_once_with(
        path=file_path,
        filename="real_file.pptx",
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
