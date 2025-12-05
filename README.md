
# ChatPPT - AI 智能演示文稿生成系统

ChatPPT 是一个基于 **RAG (检索增强生成)** 和 **LLM (大语言模型)** 的现代化全栈应用。它采用 Monorepo 架构，实现了从自然语言/文档上传到 PPTX 文件的端到端生成。



## 📋 核心架构 (Architecture)

项目采用标准的**前后端分离**架构：

* **Frontend**: React + Vite + MUI + Zustand (Store-Driven UI) + React Router (Client-side Routing)
* **Backend**: Python FastAPI + LangChain + milvus(rag)
* **Infrastructure**: Redis (消息代理与缓存)



## 🛠️ 前置依赖 (Prerequisites)

在启动项目前，请确保您的环境已安装以下服务：

1.  **Node.js**: v18+ (推荐使用 LTS 版本)
2.  **Python**: v3.10+
3.  **Redis**: **(必须)** 用于 Celery 任务队列和 Session 存储。

### ⚡ 快速安装 Redis (如果尚未安装)

如果您有 Docker，这是最快的方式：
```bash
docker run -d -p 6379:6379 --name chatppt-redis redis:alpine
````

如果您使用 Windows 且没有 Docker，请下载 Redis Windows 版并确保服务已启动。

--

## 🚀 启动指南 (Development Setup)

请分别打开三个终端窗口，按照以下顺序启动服务。

### 第一步：后端服务 (Backend API)

1.  **进入目录 & 配置环境**

    ```bash
    cd backend

    # 复制环境配置文件 (如果没有，请新建并填入您的 DeepSeek API Key)
    cp .env.example .env 
    # 或者手动创建 .env 文件，内容如下：
    # DEEPSEEK_API_KEY=sk-xxxxxx
    # REDIS_URL=redis://localhost:6379/0
    # CELERY_BROKER_URL=redis://localhost:6379/0
    ```

2.  **安装依赖**

    ```bash
    pip install -r requirements.txt
    ```

3.  **启动 API 服务器**

    ```bash
    uvicorn app.main:app --reload --port 8000
    ```

    *API 文档地址: http://localhost:8000/docs*



### 第二步：前端应用 (Frontend)

1.  **进入目录**

    ```bash
    cd frontend
    ```

2.  **安装依赖**

    ```bash
    npm install
    ```

3.  **启动开发服务器**

    ```bash
    npm run dev
    ```

    *访问地址: http://localhost:3000* (端口可能因占用而变动，请查看终端输出)

### 第三步：镜像打包 (容器)
1.  **执行脚本**

    ```bash
    bash manage.sh
    ```