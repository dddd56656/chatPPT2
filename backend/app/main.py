"""
FastAPI应用主入口文件
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import router
from app.services.rag import rag_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # [Startup]
    print(f"[STARTUP] {settings.app_name} is starting up...")
    try:
        rag_service.initialize()
    except Exception as e:
        print(f"[ERROR] Critical Error during startup: {e}")
    
    yield
    
    # [Shutdown]
    print(f"[SHUTDOWN] {settings.app_name} is shutting down...")

app = FastAPI(
    title=settings.app_name, 
    debug=settings.debug,
    lifespan=lifespan
)

# [Dynamic CORS] 解析逗号分隔的字符串
origins_list = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"status": "healthy", "service": settings.app_name}

@app.get("/health")
def health_check():
    return {"status": "healthy"}