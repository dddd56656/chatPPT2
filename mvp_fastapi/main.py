"""
FastAPI应用入口点，提供PPT生成API和Web界面
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from services.outline import create_outline_generator
from services.design import TemplateEngine

# 加载环境变量
load_dotenv()

# --- 配置 ---
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- FastAPI应用 ---
app = FastAPI(
    title="PPT生成器API",
    description="基于LangChain的智能PPT生成服务",
    version="1.0.0"
)

# --- 静态文件和模板 ---
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- 全局服务实例 ---
from services.exporter import PPTExporter
template_engine = TemplateEngine(exporter=PPTExporter())
outline_generator = None

# --- Pydantic模型 ---
class GeneratePPTRequest(BaseModel):
    """生成PPT请求模型"""
    prompt: str
    output_title: Optional[str] = None

class GenerateOutlineRequest(BaseModel):
    """生成大纲请求模型"""
    prompt: str

# --- 启动时初始化 ---
@app.on_event("startup")
async def startup_event():
    """应用启动时初始化服务"""
    global outline_generator
    try:
        outline_generator = create_outline_generator()
        logger.info("大纲生成器初始化成功")
    except Exception as e:
        logger.error(f"大纲生成器初始化失败: {e}")
        outline_generator = None

# --- API路由 ---
@app.get("/")
async def read_root(request: Request):
    """首页"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/generate-outline")
async def generate_outline(request: GenerateOutlineRequest):
    """
    生成PPT大纲API
    
    Args:
        request: 包含用户提示的请求
        
    Returns:
        JSON响应包含大纲信息
    """
    if not outline_generator:
        raise HTTPException(status_code=500, detail="大纲生成器未初始化")
    
    try:
        result = outline_generator.generate_outline(request.prompt)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"生成大纲失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成大纲失败: {str(e)}")

@app.post("/api/generate-ppt")
async def generate_ppt(request: GeneratePPTRequest):
    """
    生成完整PPT API
    
    Args:
        request: 包含用户提示和输出标题的请求
        
    Returns:
        JSON响应包含生成结果或文件下载
    """
    if not outline_generator:
        raise HTTPException(status_code=500, detail="大纲生成器未初始化")
    
    try:
        # 生成完整PPT
        result = outline_generator.generate_complete_ppt(
            user_prompt=request.prompt,
            template_engine=template_engine
        )
        
        if result["status"] == "success":
            # 如果生成了PPT文件，返回文件下载信息
            if result.get("ppt_file"):
                return JSONResponse(content={
                    "status": "success",
                    "message": result["message"],
                    "file_path": result["ppt_file"],
                    "download_url": f"/download/{os.path.basename(result['ppt_file'])}",
                    "main_topic": result["main_topic"],
                    "slides_count": result["slides_count"]
                })
            else:
                return JSONResponse(content=result)
        else:
            return JSONResponse(content=result, status_code=500)
            
    except Exception as e:
        logger.error(f"生成PPT失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成PPT失败: {str(e)}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    """
    下载生成的PPT文件
    
    Args:
        filename: 文件名
        
    Returns:
        FileResponse: PPT文件下载
    """
    file_path = os.path.join("output", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )

@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "services": {
            "outline_generator": outline_generator is not None,
            "template_engine": template_engine is not None
        }
    }

# --- 错误处理 ---
@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """500错误处理"""
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "服务器内部错误"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
