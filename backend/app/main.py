"""
FastAPI应用主入口文件 - 初始化应用实例和路由配置
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
# CTO注：这里的 'router' 来自 app/routers/__init__.py
# 它聚合了 tasks.py 和 generation.py
from app.routers import router

# 创建FastAPI应用实例
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

# --- [CTO 修复与注释] ---
# 修复：强化CORS（跨域资源共享）策略。
# 1. 移除了不安全的 "allow_origins=["*"]"。
# 2. 明确指定了前端来源 (来自你的原始代码)。
# 3. 限制了 "allow_headers"，不再使用 "*"
# -------------------------
app.add_middleware(
    CORSMiddleware,
    # 仅允许来自指定的前端地址
    allow_origins=[
        "http://localhost:3001",  # 假设的前端开发服务器
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    # 允许所有标准和非标准的HTTP方法
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    # 仅允许特定的、已知的前端会发送的Header
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# 注册所有API路由，统一添加 /api/v1 前缀
app.include_router(router, prefix="/api/v1")


@app.get("/")
def read_root():
    """根路径健康检查 (用于外部监控)"""
    return {"status": "healthy", "service": settings.app_name}


@app.get("/health")
def health_check():
    """健康检查端点 (用于K8s等)"""
    return {"status": "healthy"}
