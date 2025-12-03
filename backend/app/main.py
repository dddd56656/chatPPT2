"""
FastAPI应用主入口文件 - 初始化应用实例和路由配置
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import router

# 创建FastAPI应用实例
app = FastAPI(title=settings.app_name, debug=settings.debug)

# [CTO Fix]: 完善 CORS 策略，允许前端常用的 3000 端口
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",  # [New] Fix React default port
        "http://127.0.0.1:3000",  # [New] Fix React default port
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# 注册所有API路由
app.include_router(router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"status": "healthy", "service": settings.app_name}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
