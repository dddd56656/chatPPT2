# ChatPPT - AI驱动的智能演示文稿生成器

一个基于FastAPI后端和React前端的现代化PPT生成系统，采用Monorepo架构设计。

## 🚀 功能特性

- **智能生成**: 基于多Agent协作自动生成大纲、内容和设计
- **异步处理**: 使用Celery和Redis实现任务队列和异步处理
- **现代化架构**: 前后端分离，支持容器化部署
- **专业输出**: 生成标准PPTX格式的专业演示文稿
- **实时监控**: 前端实时显示任务进度和状态

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

#### 后端服务

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端服务

```bash
cd frontend
npm install
npm run dev
```

## 🔧 开发指南

### 环境要求

- Python 3.8+
- Node.js 16+
- Redis 6+
- Docker & Docker Compose（可选）

### 核心架构

- **后端**: FastAPI + Celery + Redis
- **前端**: React + Vite + Axios
- **任务队列**: Celery用于异步PPT生成
- **存储**: Redis用于任务状态管理

## 📚 API文档

启动后端服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要API端点

- `POST /api/tasks` - 创建PPT生成任务
- `GET /api/tasks/{task_id}` - 获取任务状态
- `GET /api/tasks/{task_id}/download` - 下载生成的PPT文件

## 🤝 贡献指南

请查看[CONTRIBUTING.md](CONTRIBUTING.md)了解如何为项目做出贡献。

## 📄 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

## 🐛 问题报告

如有问题或建议，请通过GitHub Issues联系我们。