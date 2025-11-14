"""
实际API测试文件 - 测试真实的后端路由功能
"""

import pytest
import sys
import os

# 添加当前目录到Python路径，这样就能导入app模块了
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.task import TaskRequest, TaskStatus


class TestRealAPI:
    """真实API测试 - 测试实际的后端功能"""
    
    def setup_method(self):
        """每个测试方法前的设置"""
        self.client = TestClient(app)
    
    def test_root_endpoint(self):
        """测试根路径健康检查"""
        response = self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data
    
    def test_health_check(self):
        """测试健康检查端点"""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_create_task_success(self):
        """测试创建任务成功"""
        task_request = {"user_prompt": "生成关于人工智能发展趋势的演示文稿"}
        
        response = self.client.post("/api/v1/tasks", json=task_request)
        assert response.status_code == 200
        
        data = response.json()
        assert "task_id" in data
        assert data["status"] == TaskStatus.PENDING
        assert data["result"] is None
        assert data["error"] is None
    
    def test_create_task_invalid_request(self):
        """测试创建任务 - 无效请求"""
        invalid_request = {}
        response = self.client.post("/api/v1/tasks", json=invalid_request)
        assert response.status_code == 422  # 验证错误
    
    def test_get_task_status(self):
        """测试获取任务状态"""
        # 先创建任务
        task_request = {"user_prompt": "测试任务状态查询"}
        create_response = self.client.post("/api/v1/tasks", json=task_request)
        task_id = create_response.json()["task_id"]
        
        # 查询任务状态
        response = self.client.get(f"/api/v1/tasks/{task_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["task_id"] == task_id
        assert "status" in data
        assert "result" in data
        assert "error" in data
    
    def test_invalid_task_id(self):
        """测试无效任务ID的处理"""
        response = self.client.get("/api/v1/tasks/non-existent-task-id")
        # 应该返回某种状态，而不是崩溃
        assert response.status_code in [200, 404, 500]
    
    def test_task_download_endpoint_exists(self):
        """测试下载端点存在"""
        # 检查应用路由
        routes = [route for route in app.routes if hasattr(route, 'path')]
        route_paths = [route.path for route in routes]
        
        # 验证下载端点存在
        download_endpoints = [path for path in route_paths if "download" in path]
        assert len(download_endpoints) > 0
    
    def test_task_request_model(self):
        """测试任务请求数据模型"""
        # 测试有效请求
        valid_request = TaskRequest(user_prompt="生成演示文稿")
        assert valid_request.user_prompt == "生成演示文稿"
        
        # 测试无效请求
        with pytest.raises(ValueError):
            TaskRequest()
    
    def test_api_structure(self):
        """测试API结构完整性"""
        # 验证所有必要的端点都存在
        routes = [route for route in app.routes if hasattr(route, 'path')]
        route_paths = [route.path for route in routes]
        
        # 关键端点应该存在
        required_endpoints = [
            "/",
            "/health", 
            "/api/v1/tasks"
        ]
        
        for endpoint in required_endpoints:
            assert endpoint in route_paths, f"端点 {endpoint} 不存在"
    
    def test_error_handling(self):
        """测试错误处理"""
        # 测试无效的JSON请求
        response = self.client.post("/api/v1/tasks", data="invalid json")
        # 应该返回适当的错误状态码
        assert response.status_code in [400, 422, 500]


def test_app_initialization():
    """测试应用初始化"""
    # 验证FastAPI应用可以正常初始化
    assert app.title == "ChatPPT"
    assert hasattr(app, 'router')
    assert len(app.routes) > 0


class TestResponseValidation:
    """响应验证测试"""
    
    def setup_method(self):
        self.client = TestClient(app)
    
    def test_task_response_format(self):
        """测试任务响应格式"""
        task_request = {"user_prompt": "测试响应格式"}
        response = self.client.post("/api/v1/tasks", json=task_request)
        
        data = response.json()
        
        # 验证响应包含所有必要字段
        required_fields = ["task_id", "status", "result", "error"]
        for field in required_fields:
            assert field in data, f"响应缺少字段: {field}"
        
        # 验证状态是有效的枚举值
        valid_statuses = ["pending", "progress", "success", "failure"]
        assert data["status"] in valid_statuses