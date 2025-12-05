"""
FastAPI应用主入口文件 - 初始化应用实例和路由配置
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import router
from app.services.rag import rag_service # [New Import]

# [CTO Pattern]: Lifespan Context Manager
# 这是管理应用启动和关闭逻辑的标准方式 (替代旧版 @app.on_event)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    print(f"🚀 {settings.app_name} is starting up...")
    
    # 1. 显式初始化 RAG 服务 (加载模型)
    # 这会阻塞启动直到模型加载完成，确保 Readines Probe 通过
    try:
        rag_service.initialize()
    except Exception as e:
        print(f"❌ Critical Error during startup: {e}")
        # 在生产环境中，这里可能选择直接退出进程
    
    yield # 应用运行中...
    
    # --- Shutdown Logic ---
    print(f"🛑 {settings.app_name} is shutting down...")
    # 这里可以添加关闭数据库连接、清理缓存等逻辑

# 创建FastAPI应用实例 (注入 lifespan)
app = FastAPI(
    title=settings.app_name, 
    debug=settings.debug,
    lifespan=lifespan # [New]
)

# CORS 策略
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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
    # 健康检查接口
    return {"status": "healthy"}