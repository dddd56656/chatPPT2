# ChatPPT - AI驱动的智能演示文稿生成器

一个基于FastAPI后端和React前端的现代化PPT生成系统，采用Monorepo架构设计。

## 🚀 功能特性

- **智能生成**: 基于多Agent协作自动生成大纲、内容和设计
- **异步处理**: 使用Celery和Redis实现任务队列和异步处理
- **现代化架构**: 前后端分离，支持容器化部署
- **专业输出**: 生成标准PPTX格式的专业演示文稿
- **实时监控**: 前端实时显示任务进度和状态
- **谷歌标准UI**: 前端界面遵循Material Design指南，提供一致且可访问的用户体验

## 📁 项目结构

```
chatPPT/
├── backend/                    # FastAPI后端服务
│   ├── app/                   # 应用核心模块
│   ├── templates/             # 模板文件
│   └── output/                # 生成文件输出目录
├── frontend/                  # React前端应用
│   └── src/                   # 前端源代码
├── docker-compose.yml         # 容器编排配置
└── README.md                  # 项目说明文档
```

## 🛠️ 快速开始

### 使用Docker Compose（推荐）

```bash
# 一键启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:8000
# API文档: http://localhost:8000/docs
```

### 手动安装

#### 1. 后端服务

```bash
cd backend

# 使用uv安装依赖（推荐）
uv sync

# 或者使用pip安装依赖
pip install -r requirements.txt

# 启动FastAPI服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Celery Worker（异步任务处理）

**Windows开发环境**：
```bash
cd backend
uv run celery -A app.worker.tasks worker --loglevel=info --pool=solo
```

**Linux/macOS开发环境**：
```bash
cd backend
uv run celery -A app.worker.tasks worker --loglevel=info
```

**生产环境**：
```bash
cd backend
celery -A app.worker.tasks worker --concurrency=4 --loglevel=info
```

#### 3. 前端服务

```bash
cd frontend
npm install
npm run dev
```

#### 4. 一键启动（Windows）

使用提供的启动脚本：
```bash
start_dev.bat
```

## 🔧 开发指南

### 环境要求

- Python 3.8+
- Node.js 16+
- Redis 6+
- Docker & Docker Compose（可选）

### 核心架构

- **后端**: FastAPI + Celery + Redis
- **前端**: React + Vite + Axios + Tailwind CSS
- **任务队列**: Celery用于异步PPT生成
- **存储**: Redis用于任务状态管理
- **AI集成**: DeepSeek API via LangChain

### 平台兼容性说明

- **Windows**: 开发环境需要使用`--pool=solo`参数启动Celery
- **Linux/macOS**: 支持标准Celery配置，性能最佳
- **生产环境**: 建议部署到Linux服务器，使用多进程模式

## 📚 API文档

启动后端服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要API端点

- `POST /api/v1/stream/outline` - 流式生成PPT大纲 (Server-Sent Events)
- `POST /api/v1/stream/content` - 流式生成PPT内容 (Server-Sent Events)
- `POST /api/v1/generation/export` - 提交PPT导出任务
- `GET /api/v1/tasks/{task_id}` - 获取任务状态
- `GET /api/v1/tasks/{task_id}/file` - 下载生成的PPT文件

## 🤝 贡献指南

请查看[CONTRIBUTING.md](CONTRIBUTING.md)了解如何为项目做出贡献。

## 📄 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

## 🐛 问题报告

如有问题或建议，请通过GitHub Issues联系我们。