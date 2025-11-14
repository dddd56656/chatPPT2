@echo off
echo 启动ChatPPT开发环境...

echo 1. 启动前端开发服务器...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo 2. 启动后端API服务器...
start "Backend API" cmd /k "cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo 3. 启动Celery Worker...
start "Celery Worker" cmd /k "cd backend && uv run celery -A app.worker.tasks worker --loglevel=info"

echo 所有服务启动完成！
echo 前端: http://localhost:3001
echo 后端: http://localhost:8000
echo Celery Worker: 正在运行
pause