"""FastAPI应用主入口文件 - 初始化应用实例和路由配置"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routers import router

# 创建FastAPI应用实例
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

# 配置CORS中间件 - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 允许的HTTP方法
    allow_headers=["*"],  # 允许所有HTTP头
)

# 注册路由
app.include_router(router, prefix="/api/v1")


@app.get("/")
def read_root():
    """根路径健康检查"""
    return {"status": "healthy", "service": settings.app_name}


@app.get("/health")
def health_check():
    """健康检查端点"""
    return {"status": "healthy"}